import { State } from "../state";
import { killProcess } from "../utils/process";
import { clearStatusBar } from "../utils/self/statusBar";

export default async function stopAnalyse($: State) {
  $.vscode.outputChannel.appendLine("# Command: stop analyse");
  if ($.process.instance) {
    $.process.killed = true;
    await killProcess($.process.instance);
    clearStatusBar($);
    $.process.instance = $.process.killed = null;
  }
}
