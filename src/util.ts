import { ChildProcessWithoutNullStreams, exec } from "child_process"
import { promises as fs } from "fs"
import { platform } from "os"
import { parse } from "yaml"

export async function killProcess(
	process: ChildProcessWithoutNullStreams
): Promise<void> {
	const os = platform()
	if (os === "win32") {
		return new Promise((resolve) => {
			exec(`taskkill /pid ${process.pid} /T /F`, () => resolve())
		})
	} else {
		process.kill()
	}
}

export async function checkFile(path: string): Promise<boolean> {
	try {
		await fs.stat(path)
		return true
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
		throw error
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseYaml<T = any>(path: string): Promise<T> {
	let contents = (await fs.readFile(path)).toString()
	contents = contents.replace(/\t/g, "  ")
	return parse(contents)
}

export async function waitForClose(
	childProcess: ChildProcessWithoutNullStreams
): Promise<[number, string]> {
	return new Promise<[number, string]>((resolve, reject) => {
		let result = ""
		childProcess.stdout.on("data", (data) => (result += data))
		childProcess.on("error", reject)
		childProcess.on("close", (exitCode) => resolve([exitCode, result]))
	})
}
