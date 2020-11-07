import * as vscode from "vscode"
import { ChildProcessWithoutNullStreams, spawn } from "child_process"
import { waitForClose } from "./util"

type PhpstanResult = {
	totals: {
		errors: number
		file_errors: number
	}
	files: {
		[path: string]: {
			errors: number
			messages: {
				message: string
				line: number
				ignorable: boolean
			}[]
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	errors: any[]
}

type SettingsType = {
	enabled: boolean
	path: string
	phpPath: string
	fileWatcher: boolean
	configFileWatcher: boolean
	configFileWatcherBasenames: string[]
	fileWatcherPattern: string
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
let settings: SettingsType

let currentProcessTimeout: NodeJS.Timeout
let currentProcess: ChildProcessWithoutNullStreams | null
let currentProcessKilled: boolean | null

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(context: vscode.ExtensionContext): void {
	settings = getSettings()

	settingsListener = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration(EXT_NAME)) {
			deactivate()
			activate(context)
		}
	})

	if (!settings.enabled) return

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
		fileWatcherPattern: get("fileWatcherPattern"),
		configFileWatcher: get("configFileWatcher"),
		configFileWatcherBasenames: get("configFileWatcherBasenames"),
		analysedDelay: get("analysedDelay"),
		memoryLimit: get("memoryLimit"),
	}
}

async function init() {
	fileWatcher?.dispose()
	if (settings.fileWatcher) fileWatcher = createFileWatcher()
	phpstanAnalyseDelayed(0)
}

function createFileWatcher() {
	const watcher = vscode.workspace.createFileSystemWatcher(
		settings.fileWatcherPattern
	)
	watcher.onDidChange(async (uri) => {
		outputChannel.appendLine(`# File changed: ${uri.fsPath}`)
		phpstanAnalyseDelayed()
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

function setAnalysingStatusBar(progress?: number) {
	let text = "$(sync~spin) PHPStan analysing..."
	if (progress > 0) text += ` (${progress}%)`
	statusBarItem.text = text
	statusBarItem.tooltip = ""
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
	const phpPath = settings.phpPath
	const phpStanPath = settings.path
	const memoryLimit = settings.memoryLimit

	setAnalysingStatusBar()

	try {
		const args = ["-f", phpStanPath, "analyse"]
			.concat(memoryLimit ? ["--memory-limit=" + memoryLimit] : [])
			.concat(["--error-format=json"])

		const childProcess = (currentProcess = spawn(phpPath, args, {
			cwd: vscode.workspace.rootPath,
		}))

		childProcess.stdout.on("data", (data: Buffer) =>
			outputChannel.appendLine(data.toString())
		)

		childProcess.stderr.on("data", (data: Buffer) => {
			const progress = /(\d{1,3})%\s*$/.exec(data.toString())?.[1]
			if (progress) setAnalysingStatusBar(Number(progress))
			outputChannel.appendLine(data.toString())
		})

		const [, stdout] = await waitForClose(childProcess)

		if (currentProcessKilled) {
			currentProcessKilled = false
			return
		}

		const phpstanResult = parsePhpstanStdout(stdout)

		refreshDiagnostics(phpstanResult)
	} catch (error) {
		outputChannel.appendLine((error as Error).message)
		statusBarItem.text = `$(error) PHPStan`
		statusBarItem.tooltip = `Spawn error: ${(error as Error).message}`
		return
	}

	statusBarItem.tooltip = ""
	statusBarItem.hide()
}

function parsePhpstanStdout(stdout: string): PhpstanResult {
	return JSON.parse(stdout)
}

async function refreshDiagnostics(result: PhpstanResult) {
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
