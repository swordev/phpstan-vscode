import { State } from "../state";
import { sanitizeFsPath } from "../utils/path";
import { analyse } from "./analyse";
import { Uri, window } from "vscode";

export default async function analyseCurrentPath($: State, uri?: Uri) {
  const fsPath = uri?.fsPath || window.activeTextEditor?.document.uri.fsPath;
  if (fsPath) await analyse($, undefined, [sanitizeFsPath(fsPath)]);
}
