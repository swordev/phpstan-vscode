import { Ext } from "../extension";
import pauseFileWatcher from "./pauseFileWatcher";
import resumeFileWatcher from "./resumeFileWatcher";

export default function toggleFileWatcher(ext: Ext) {
  ext.store.fileWatcher.enabled
    ? pauseFileWatcher(ext)
    : resumeFileWatcher(ext);
}
