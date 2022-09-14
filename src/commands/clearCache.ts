import { State } from "../state";
import { waitForClose } from "../utils/process";
import { getCommandName } from "../utils/self/command";
import { clearStatusBar } from "../utils/self/statusBar";
import showOutput from "./showOutput";
import { spawn } from "child_process";

export async function clearCache($: State) {
  $.vscode.outputChannel.appendLine("# Command: clearCache");

  $.vscode.statusBarItem.text = "$(sync~spin) PHPStan clearing cache...";
  $.vscode.statusBarItem.tooltip = "";
  $.vscode.statusBarItem.command = getCommandName(showOutput);
  $.vscode.statusBarItem.show();

  try {
    const childProcess = spawn(
      $.settings.phpPath,
      [
        "-f",
        $.settings.path,
        "--",
        "clear-result-cache",
        ...($.phpstan.configPath ? ["-c", $.phpstan.configPath] : []),
      ],
      {
        cwd: $.phpstan.settings.rootPath,
      }
    );

    childProcess.stdout.on("data", (data: Buffer) =>
      $.vscode.outputChannel.appendLine(data.toString())
    );

    childProcess.stderr.on("data", (data: Buffer) => {
      $.vscode.outputChannel.appendLine(data.toString());
    });

    await waitForClose(childProcess);
  } catch (error) {
    $.vscode.outputChannel.appendLine(
      error instanceof Error
        ? error.stack || error.message
        : `Unknown error: ${error}`
    );
  }

  clearStatusBar($);
}
