import showOutput from "../../commands/showOutput";
import { State } from "../../state";
import { getCommandName } from "./command";

export function clearStatusBar($: State) {
  $.vscode.statusBarItem.text = "";
  delete $.vscode.statusBarItem.tooltip;
  delete $.vscode.statusBarItem.command;
  $.vscode.statusBarItem.hide();
}

export function setStatusBarError($: State, error: unknown, source: string) {
  const errorMessage =
    error instanceof Error ? error.message : new String(error).toString();
  $.vscode.outputChannel.appendLine(`# ${source}`);
  $.vscode.outputChannel.appendLine(errorMessage);
  $.vscode.statusBarItem.text = `$(error) PHPStan`;
  $.vscode.statusBarItem.tooltip = `${source}: ${errorMessage}`;
  $.vscode.statusBarItem.command = getCommandName(showOutput);
  $.vscode.statusBarItem.show();
  return false;
}
