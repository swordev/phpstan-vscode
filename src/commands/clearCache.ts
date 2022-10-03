import { Ext } from "../extension";
import { waitForClose } from "../utils/process";
import showOutput from "./showOutput";
import { spawn } from "child_process";

export async function clearCache(ext: Ext) {
  const { settings } = ext;

  ext.setStatusBar({
    text: "$(sync~spin) PHPStan clearing cache...",
    command: showOutput,
  });

  const childProcess = spawn(
    settings.phpPath,
    [
      "-f",
      settings.path,
      "--",
      "clear-result-cache",
      ...(ext.store.phpstan.configPath
        ? ["-c", ext.store.phpstan.configPath]
        : []),
    ],
    {
      cwd: ext.cwd,
    }
  );

  childProcess.stdout.on("data", (buffer: Buffer) => ext.log(buffer));

  childProcess.stderr.on("data", (buffer: Buffer) => {
    ext.log(buffer);
  });

  await waitForClose(childProcess);
}
