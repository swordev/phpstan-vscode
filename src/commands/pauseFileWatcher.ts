import { Ext } from "../extension";
import resumeFileWatcher from "./resumeFileWatcher";

export default function pauseFileWatcher(ext: Ext) {
  ext.setStatusBar({
    text: "$(debug-pause) PHPStan",
    tooltip: "Resume file watcher",
    command: resumeFileWatcher,
  });
  ext.store.fileWatcher.enabled = false;
}
