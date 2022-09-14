import { State } from "../state";
import { getCommandName } from "../utils/self/command";
import resumeFileWatcher from "./resumeFileWatcher";

export default function pauseFileWatcher($: State) {
  $.fileWatcherState = false;
  $.vscode.statusBarItem.text = "$(debug-pause) PHPStan";
  $.vscode.statusBarItem.tooltip = "Resume file watcher";
  $.vscode.statusBarItem.command = getCommandName(resumeFileWatcher);
  $.vscode.statusBarItem.show();
}
