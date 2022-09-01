import * as vscode from "vscode"
import { ChildProcessWithoutNullStreams, spawn } from "child_process"
import { killProcess, waitForClose } from "./util"
import { uncolorize } from "./util/color"
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

let currentProcessTimeout: NodeJS.Timeout
let currentProcess: ChildProcessWithoutNullStreams | null
let currentProcessKilled: boolean | null

let initTimeout: NodeJS.Timeout

let config: ConfigType = null
let configPath: string = null
let settings: SettingsType = null
let fileWatcherState = true

const $: {
	rootPath?: string
	diagnosticCollection?: vscode.DiagnosticCollection
	outputChannel?: vscode.OutputChannel
	statusBarItem?: vscode.StatusBarItem
	configFileWatcher?: vscode.FileSystemWatcher
	fileWatcher?: vscode.FileSystemWatcher
	listeners?: vscode.Disposable[]
} = {}

export function activate(context: vscode.ExtensionContext): void {
	settings = getSettings()

	$.rootPath = getWorkspacePath()
	$.listeners = [
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(EXT_NAME)) {
				deactivate()
				activate(context)
			}
		}),
	]

	if (!settings.enabled || !$.rootPath) return

	vscode.commands.executeCommand("setContext", `${EXT_NAME}:enabled`, true)

	PHPStan.settings = {
		basenames: settings.configFileWatcherBasenames,
		path: settings.path,
		rootPath: sanitizeFsPath($.rootPath),
	}

	$.outputChannel = vscode.window.createOutputChannel(EXT_NAME)
	$.diagnosticCollection = vscode.languages.createDiagnosticCollection(
		EXT_NAME
	)
	$.statusBarItem = vscode.window.createStatusBarItem()

	const commands: ((...args: unknown[]) => void)[] = [
		showOutputCommand,
		analyseCommand,
		analyseCurrentPathCommand,
		pauseFileWatcherCommand,
		resumeFileWatcherCommand,
		toggleFileWatcherCommand,
		clearProblemsCommand,
		clearCacheCommand,
	]

	for (const command of commands)
		$.listeners.push(
			vscode.commands.registerCommand(getCommandName(command), command)
		)

	if (settings.configFileWatcher) {
		$.configFileWatcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(
				$.rootPath,
				`{${settings.configFileWatcherBasenames.join(",")}}`
			)
		)
		onFileWatcherEvent($.configFileWatcher, async (uri, eventName) => {
			if (!fileWatcherState) return
			const fsPath = sanitizeFsPath(uri.fsPath)
			$.outputChannel.appendLine(`# Config file ${eventName}: ${fsPath}`)
			clearTimeout(initTimeout)
			initTimeout = setTimeout(async () => await init(), 250)
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
	$.fileWatcher?.dispose()
	try {
		configPath = await PHPStan.findConfigPath()
		config = configPath ? await PHPStan.parseConfig(configPath) : null
	} catch (error) {
		return setStatusBarError(error, "Parse config error")
	}
	$.outputChannel.appendLine(`# Config:\n${JSON.stringify(config, null, 2)}`)
	if (config) {
		if (settings.fileWatcher) $.fileWatcher = createFileWatcher()
		analyseCommand(0)
	}
}

function createFileWatcher() {
	const watcher = vscode.workspace.createFileSystemWatcher(
		`**/*.{${config.parameters.fileExtensions.join(",")}}`
	)

	onFileWatcherEvent(watcher, async (uri, eventName) => {
		if (!fileWatcherState) return
		for (const path of config.parameters.paths) {
			const fsPath = sanitizeFsPath(uri.fsPath)
			if (fsPath.startsWith(path)) {
				$.outputChannel.appendLine(`# File ${eventName}: ${fsPath}`)
				return await analyseCommand()
			}
		}
	})

	return watcher
}

export function deactivate(): void {
	for (const key in $) {
		const value = $[key]
		if (isDisposable(value)) {
			value.dispose()
		} else if (Array.isArray(value)) {
			for (const subvalue of value) {
				if (isDisposable(subvalue)) {
					subvalue.dispose()
				}
			}
		}
		delete $[key]
	}
	vscode.commands.executeCommand("setContext", `${EXT_NAME}:enabled`, false)
}

function onFileWatcherEvent(
	watcher: vscode.FileSystemWatcher,
	cb: (uri: vscode.Uri, eventName: "created" | "deleted" | "changed") => void
) {
	watcher.onDidCreate((uri) => cb(uri, "created"))
	watcher.onDidDelete((uri) => cb(uri, "deleted"))
	watcher.onDidChange((uri) => cb(uri, "changed"))
}

function isDisposable(object: unknown): object is vscode.Disposable {
	return object && typeof object["dispose"] === "function"
}

function clearStatusBar() {
	delete $.statusBarItem.text
	delete $.statusBarItem.tooltip
	delete $.statusBarItem.command
	$.statusBarItem.hide()
}

function setStatusBarProgress(progress?: number) {
	let text = "$(sync~spin) PHPStan analysing..."
	if (progress > 0) text += ` (${progress}%)`
	$.statusBarItem.text = text
	$.statusBarItem.tooltip = ""
	$.statusBarItem.command = getCommandName(showOutputCommand)
	$.statusBarItem.show()
}

function setStatusBarError(error: Error, source: string) {
	$.outputChannel.appendLine(`# ${source}`)
	$.outputChannel.appendLine(error.message)
	$.statusBarItem.text = `$(error) PHPStan`
	$.statusBarItem.tooltip = `${source}: ${error.message}`
	$.statusBarItem.command = getCommandName(showOutputCommand)
	$.statusBarItem.show()
}

function setStatusBarPausedFileWatcher() {
	$.statusBarItem.text = "$(debug-pause) PHPStan"
	$.statusBarItem.tooltip = "Resume file watcher"
	$.statusBarItem.command = getCommandName(resumeFileWatcherCommand)
	$.statusBarItem.show()
}

function getCommandName(commandFunction: () => void) {
	return `${EXT_NAME}.${commandFunction.name.replace(/Command$/, "")}`
}

function showOutputCommand() {
	$.outputChannel.show()
}

async function analyseCommand(ms?: number, args?: string[]) {
	clearTimeout(currentProcessTimeout)
	currentProcessTimeout = setTimeout(async () => {
		$.outputChannel.appendLine("# Command: analyse")
		if (currentProcess) {
			currentProcessKilled = true
			await killProcess(currentProcess)
		}
		await phpstanAnalyse(args)
		currentProcess = currentProcessKilled = null
	}, ms ?? settings.analysedDelay)
}

async function analyseCurrentPathCommand(uri: vscode.Uri) {
	const fsPath =
		uri?.fsPath || vscode.window.activeTextEditor?.document.uri.fsPath
	if (fsPath) await analyseCommand(null, [sanitizeFsPath(fsPath)])
}

function pauseFileWatcherCommand() {
	fileWatcherState = false
	setStatusBarPausedFileWatcher()
}

function resumeFileWatcherCommand() {
	fileWatcherState = true
	analyseCommand()
}

function toggleFileWatcherCommand() {
	fileWatcherState ? pauseFileWatcherCommand() : resumeFileWatcherCommand()
}

function clearProblemsCommand() {
	$.diagnosticCollection.clear()
}

async function clearCacheCommand() {
	$.outputChannel.appendLine("# Command: clearCache")

	$.statusBarItem.text = "$(sync~spin) PHPStan clearing cache..."
	$.statusBarItem.tooltip = ""
	$.statusBarItem.command = getCommandName(showOutputCommand)
	$.statusBarItem.show()

	try {
		const childProcess = spawn(
			settings.phpPath,
			["-f", settings.path, "clear-result-cache"],
			{
				cwd: PHPStan.settings.rootPath,
			}
		)

		childProcess.stdout.on("data", (data: Buffer) =>
			$.outputChannel.appendLine(data.toString())
		)

		childProcess.stderr.on("data", (data: Buffer) => {
			$.outputChannel.appendLine(data.toString())
		})

		await waitForClose(childProcess)
	} catch (error) {
		$.outputChannel.appendLine(error)
	}

	clearStatusBar()
}

async function phpstanAnalyse(args?: string[]) {
	setStatusBarProgress()

	try {
		args = ["-f", settings.path, "analyse"]
			.concat(
				settings.memoryLimit
					? ["--memory-limit=" + settings.memoryLimit]
					: []
			)
			.concat(["--error-format=json"])
			.concat(args ?? [])

		const childProcess = (currentProcess = spawn(settings.phpPath, args, {
			cwd: PHPStan.settings.rootPath,
		}))

		childProcess.stdout.on("data", (data: Buffer) =>
			$.outputChannel.appendLine(uncolorize(data.toString()))
		)

		childProcess.stderr.on("data", (data: Buffer) => {
			const progress = /(\d{1,3})%\s*$/.exec(data.toString())?.[1]
			if (progress) setStatusBarProgress(Number(progress))
			$.outputChannel.appendLine(uncolorize(data.toString()))
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

	clearStatusBar()
}

async function refreshDiagnostics(result: ResultType) {
	$.diagnosticCollection.clear()

	const globalDiagnostics: vscode.Diagnostic[] = []

	for (const error of result.errors) {
		const range = new vscode.Range(0, 0, 0, 0)
		const diagnostic = new vscode.Diagnostic(
			range,
			error,
			vscode.DiagnosticSeverity.Error
		)
		globalDiagnostics.push(diagnostic)
	}

	if (globalDiagnostics.length)
		$.diagnosticCollection.set(
			vscode.Uri.file(configPath),
			globalDiagnostics
		)

	// https://github.com/phpstan/phpstan-src/blob/6d228a53/src/Analyser/MutatingScope.php#L289
	const contextRegex = / \(in context of .+\)$/

	for (let path in result.files) {
		const pathItem = result.files[path]
		const diagnostics: vscode.Diagnostic[] = []
		const document = await getDocumentFromPath(path)

		for (const messageItem of pathItem.messages) {
			const line = messageItem.line ? messageItem.line - 1 : 0
			const range = getRangeFromDocumentAndLine(document, line)
			const diagnostic = new vscode.Diagnostic(
				range,
				messageItem.message,
				vscode.DiagnosticSeverity.Error
			)

			diagnostics.push(diagnostic)
		}

		const matches = contextRegex.exec(path)

		if (matches) path = path.slice(0, matches.index)

		$.diagnosticCollection.set(vscode.Uri.file(path), diagnostics)
	}
}

async function getDocumentFromPath(path: string) {
	try {
		return await vscode.workspace.openTextDocument(vscode.Uri.file(path))
	} catch (error) {
		setStatusBarError(error, "Document not found")
		return null
	}
}

function getRangeFromDocumentAndLine(
	document: vscode.TextDocument | null,
	line: number
) {
	if (!document) {
		return new vscode.Range(line, 0, line, 0)
	}
	const textLine = document?.lineAt(line)
	return new vscode.Range(
		line,
		textLine.firstNonWhitespaceCharacterIndex,
		line,
		textLine.range.end.character
	)
}

function getWorkspacePath() {
	const [folder] = vscode.workspace.workspaceFolders || []
	return folder ? folder.uri.fsPath : null
}

/**
 * @link https://github.com/microsoft/vscode/blob/84a3473d/src/vs/workbench/contrib/terminal/common/terminalEnvironment.ts#L227
 */
function sanitizeFsPath(path: string) {
	if (process.platform === "win32" && path[1] === ":") {
		return path[0].toUpperCase() + path.substr(1)
	} else {
		return path
	}
}
