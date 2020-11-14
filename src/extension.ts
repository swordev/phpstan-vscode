import * as vscode from "vscode"
import { ChildProcessWithoutNullStreams, spawn } from "child_process"
import { waitForClose } from "./util"
import { PHPStan, ConfigType, ResultType } from "./PHPStan"

type SettingsType = {
	enabled: boolean
	path: string
	phpPath: string
	fileWatcher: boolean
	configFileWatcher: boolean
	configFileWatcherBasenames: string[]
	analysedDelay: number
	memoryLimit: string
}

const EXT_NAME = "phpstan"

let settingsListener: vscode.Disposable
let diagnosticCollection: vscode.DiagnosticCollection
let outputChannel: vscode.OutputChannel
let statusBarItem: vscode.StatusBarItem
let configFileWatcher: vscode.FileSystemWatcher
let fileWatcher: vscode.FileSystemWatcher
let currentProcessTimeout: NodeJS.Timeout
let currentProcess: ChildProcessWithoutNullStreams | null
let currentProcessKilled: boolean | null

let config: ConfigType = null
let settings: SettingsType = null

export function activate(context: vscode.ExtensionContext): void {
	settings = getSettings()

	settingsListener = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration(EXT_NAME)) {
			deactivate()
			activate(context)
		}
	})

	if (!settings.enabled) return

	PHPStan.settings = {
		basenames: settings.configFileWatcherBasenames,
		path: settings.path,
		rootPath: vscode.workspace.rootPath,
	}

	outputChannel = vscode.window.createOutputChannel(EXT_NAME)
	diagnosticCollection = vscode.languages.createDiagnosticCollection(EXT_NAME)
	statusBarItem = vscode.window.createStatusBarItem()

	if (settings.configFileWatcher) {
		configFileWatcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(
				vscode.workspace.rootPath,
				`{${settings.configFileWatcherBasenames.join(",")}}`
			)
		)
		configFileWatcher.onDidChange(async (uri) => {
			outputChannel.appendLine(`# Config file changed: ${uri.fsPath}`)
			await init()
		})
		init()
	}
}

function getSettings(): SettingsType {
	const config = vscode.workspace.getConfiguration(EXT_NAME)
	const get = <T extends keyof SettingsType>(name: T) =>
		config.get(name) as SettingsType[T]
	return {
		enabled: get("enabled"),
		path: get("path"),
		phpPath: get("phpPath"),
		fileWatcher: get("fileWatcher"),
		configFileWatcher: get("configFileWatcher"),
		configFileWatcherBasenames: get("configFileWatcherBasenames"),
		analysedDelay: get("analysedDelay"),
		memoryLimit: get("memoryLimit"),
	}
}

async function init() {
	fileWatcher?.dispose()
	config = await PHPStan.parseConfig()
	outputChannel.appendLine(`# Config:\n${JSON.stringify(config, null, 2)}`)
	if (config) {
		if (settings.fileWatcher) fileWatcher = createFileWatcher()
		phpstanAnalyseDelayed(0)
	}
}

function createFileWatcher() {
	const watcher = vscode.workspace.createFileSystemWatcher(
		`**/*.{${config.parameters.fileExtensions.join(",")}}`
	)

	watcher.onDidChange(async (uri) => {
		for (const path of config.parameters.paths) {
			if (uri.fsPath.startsWith(path)) {
				outputChannel.appendLine(`# File changed: ${uri.fsPath}`)
				return await phpstanAnalyseDelayed()
			}
		}
	})

	return watcher
}

export function deactivate(): void {
	settingsListener?.dispose()
	diagnosticCollection.dispose()
	outputChannel.dispose()
	statusBarItem.dispose()
	configFileWatcher?.dispose()
	fileWatcher?.dispose()
}

function setStatusBarProgress(progress?: number) {
	let text = "$(sync~spin) PHPStan analysing..."
	if (progress > 0) text += ` (${progress}%)`
	statusBarItem.text = text
	statusBarItem.tooltip = ""
	statusBarItem.show()
}

function setStatusBarError(error: Error, source: string) {
	outputChannel.appendLine(`# ${source}`)
	outputChannel.appendLine(error.message)
	statusBarItem.text = `$(error) PHPStan`
	statusBarItem.tooltip = `${source}: ${error.message}`
	statusBarItem.show()
}

async function phpstanAnalyseDelayed(ms?: number) {
	clearTimeout(currentProcessTimeout)
	currentProcessTimeout = setTimeout(async () => {
		if (currentProcess) {
			currentProcessKilled = true
			currentProcess.kill()
		}
		await phpstanAnalyse()
		currentProcess = currentProcessKilled = null
	}, ms ?? settings.analysedDelay)
}

async function phpstanAnalyse() {
	setStatusBarProgress()

	try {
		const args = ["-f", settings.path, "analyse"]
			.concat(
				settings.memoryLimit
					? ["--memory-limit=" + settings.memoryLimit]
					: []
			)
			.concat(["--error-format=json"])

		const childProcess = (currentProcess = spawn(settings.phpPath, args, {
			cwd: vscode.workspace.rootPath,
		}))

		childProcess.stdout.on("data", (data: Buffer) =>
			outputChannel.appendLine(data.toString())
		)

		childProcess.stderr.on("data", (data: Buffer) => {
			const progress = /(\d{1,3})%\s*$/.exec(data.toString())?.[1]
			if (progress) setStatusBarProgress(Number(progress))
			outputChannel.appendLine(data.toString())
		})

		const [, stdout] = await waitForClose(childProcess)

		if (currentProcessKilled) {
			currentProcessKilled = false
			return
		}

		const phpstanResult = PHPStan.parseResult(stdout)

		refreshDiagnostics(phpstanResult)
	} catch (error) {
		return setStatusBarError(error, "Spawn error")
	}

	statusBarItem.tooltip = ""
	statusBarItem.hide()
}

async function refreshDiagnostics(result: ResultType) {
	diagnosticCollection.clear()

	for (const path in result.files) {
		const pathItem = result.files[path]
		const diagnostics: vscode.Diagnostic[] = []
		for (const messageItem of pathItem.messages) {
			const range = new vscode.Range(
				messageItem.line,
				0,
				messageItem.line,
				0
			)
			const diagnostic = new vscode.Diagnostic(
				range,
				messageItem.message,
				vscode.DiagnosticSeverity.Error
			)

			diagnostics.push(diagnostic)
		}
		diagnosticCollection.set(vscode.Uri.file(path), diagnostics)
	}
}
