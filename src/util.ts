import { ChildProcessWithoutNullStreams } from "child_process"

export async function waitForClose(
	childProcess: ChildProcessWithoutNullStreams
): Promise<[number, string]> {
	return new Promise<[number, string]>((resolve, reject) => {
		let result = ""
		childProcess.stdout.on("data", (data) => (result += data + "\n"))
		childProcess.on("error", reject)
		childProcess.on("close", (exitCode) => resolve([exitCode, result]))
	})
}
