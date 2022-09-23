import { Ext } from "../extension";

export default function stopAnalyse(ext: Ext) {
  ext.store.analyse.channel.emit("stop");
}
