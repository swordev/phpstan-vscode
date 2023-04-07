/**
 * @link https://github.com/microsoft/vscode/blob/84a3473d/src/vs/workbench/contrib/terminal/common/terminalEnvironment.ts#L227
 */
export function sanitizeFsPath(path: string) {
  if (process.platform === "win32" && path[1] === ":") {
    return path[0].toUpperCase() + path.substring(1);
  } else {
    return path;
  }
}
