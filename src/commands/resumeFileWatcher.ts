import { Ext } from "../extension";
import analyse from "./analyse";

export default async function resumeFileWatcher(ext: Ext) {
  ext.setStatusBar({
    text: "$(debug-pause) PHPStan",
    tooltip: "Resume file watcher",
    command: resumeFileWatcher,
  });
  ext.store.fileWatcher.statusBarFixed = undefined;
  ext.store.fileWatcher.enabled = true;
  await analyse(ext, 0);
}
