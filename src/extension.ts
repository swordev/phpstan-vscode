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

type Settings = {
	enabled: boolean
	path: string
	phpPath: string
	fileWatcher: boolean
	fileWatcherPattern: string
	analysedDelay: number
	memoryLimit: string
}

const EXT_NAME = "phpstan"

let diagnosticCollection: vscode.DiagnosticCollection
let outputChannel: vscode.OutputChannel
let statusBarItem: vscode.StatusBarItem
let watcher: vscode.FileSystemWatcher

let currentProcessTimeout: NodeJS.Timeout
let currentProcess: ChildProcessWithoutNullStreams | null
let currentProcessKilled: boolean | null

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(context: vscode.ExtensionContext): void {
	const config = vscode.workspace.getConfiguration(EXT_NAME)

	if (!getConfigValue(config, "enabled")) return

	outputChannel = vscode.window.createOutputChannel(EXT_NAME)
	diagnosticCollection = vscode.languages.createDiagnosticCollection(EXT_NAME)
	statusBarItem = vscode.window.createStatusBarItem()

	if (getConfigValue(config, "fileWatcher")) {
		watcher = vscode.workspace.createFileSystemWatcher(
			getConfigValue(config, "fileWatcherPattern")
		)
		watcher.onDidChange(async () => phpstanAnalyseDelayed())
	}

	phpstanAnalyseDelayed(0)
}

export function deactivate(): void {
	diagnosticCollection.dispose()
	outputChannel.dispose()
	statusBarItem.dispose()
	watcher?.dispose()
}

function getConfigValue<T extends keyof Settings>(
	config: vscode.WorkspaceConfiguration,
	name: T
) {
	return config.get(name) as Settings[T]
}

function setAnalysingStatusBar(progress?: number) {
	let text = "$(sync~spin) PHPStan analysing..."
	if (progress > 0) text += ` (${progress}%)`
	statusBarItem.text = text
	statusBarItem.tooltip = ""
	statusBarItem.show()
}

async function phpstanAnalyseDelayed(ms?: number) {
	const config = vscode.workspace.getConfiguration(EXT_NAME)
	clearTimeout(currentProcessTimeout)
	currentProcessTimeout = setTimeout(async () => {
		if (currentProcess) {
			currentProcessKilled = true
			currentProcess.kill()
		}
		await phpstanAnalyse()
		currentProcess = currentProcessKilled = null
	}, ms ?? (config.get<number>("analysedDelay") as number))
}

async function phpstanAnalyse() {
	const config = vscode.workspace.getConfiguration(EXT_NAME)

	const phpPath = getConfigValue(config, "phpPath")
	const phpStanPath = getConfigValue(config, "path")
	const memoryLimit = getConfigValue(config, "memoryLimit")

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
