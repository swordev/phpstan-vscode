import { Ext } from "../extension";
import analyse from "./analyse";

export default function resumeFileWatcher(ext: Ext) {
  ext.store.fileWatcher.enabled = true;
  analyse(ext, 0);
}
