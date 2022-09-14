import { ChildProcessWithoutNullStreams, exec } from "child_process";
import { platform } from "os";

export async function killProcess(
  process: ChildProcessWithoutNullStreams
): Promise<void> {
  const os = platform();
  if (os === "win32") {
    return new Promise((resolve) => {
      exec(`taskkill /pid ${process.pid} /T /F`, () => resolve());
    });
  } else {
    process.kill();
  }
}

export async function waitForClose(
  childProcess: ChildProcessWithoutNullStreams
) {
  return new Promise<[number | null, string]>((resolve, reject) => {
    let result = "";
    childProcess.stdout.on("data", (data) => (result += data));
    childProcess.on("error", reject);
    childProcess.on("close", (exitCode) => resolve([exitCode, result]));
  });
}
