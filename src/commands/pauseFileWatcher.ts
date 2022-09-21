import { Ext } from "../extension";
import resumeFileWatcher from "./resumeFileWatcher";

export default function pauseFileWatcher(ext: Ext) {
  const { statusBarItem } = ext;
  ext.store.fileWatcher.enabled = false;
  statusBarItem.text = "$(debug-pause) PHPStan";
  statusBarItem.tooltip = "Resume file watcher";
  statusBarItem.command = ext.getCommandName(resumeFileWatcher);
  statusBarItem.show();
}
