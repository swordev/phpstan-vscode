import { Ext } from "../extension";
import { sanitizeFsPath } from "../utils/path";
import analyse from "./analyse";
import { Uri, window } from "vscode";

export default async function analyseCurrentPath(ext: Ext, uri?: Uri) {
  const fsPath = uri?.fsPath || window.activeTextEditor?.document.uri.fsPath;
  if (fsPath) await analyse(ext, 0, [sanitizeFsPath(fsPath)]);
}
