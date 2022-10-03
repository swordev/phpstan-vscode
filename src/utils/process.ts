import { ChildProcess } from "child_process";

export async function killProcess(p: ChildProcess) {
  p.stdout?.removeAllListeners();
  p.stderr?.removeAllListeners();
  try {
    return p.kill("SIGKILL");
  } catch (error) {
    return false;
  }
}

export async function waitForClose(childProcess: ChildProcess) {
  return new Promise<number | null>((resolve, reject) => {
    childProcess.on("error", reject);
    childProcess.on("exit", (exitCode) => {
      if (childProcess.killed) resolve(exitCode);
    });
    childProcess.on("close", (exitCode) => resolve(exitCode));
  });
}
