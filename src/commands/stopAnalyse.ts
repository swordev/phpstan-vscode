import { Ext } from "../extension";
import { killProcess } from "../utils/process";

export default async function stopAnalyse(ext: Ext) {
  if (ext.store.analyse.process) {
    await killProcess(ext.store.analyse.process);
    ext.clearStatusBar();
    ext.store.analyse.process = undefined;
  }
}
