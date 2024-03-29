import { isAbsolute, join, normalize } from "path";

/**
 * @link https://github.com/microsoft/vscode/blob/84a3473d/src/vs/workbench/contrib/terminal/common/terminalEnvironment.ts#L227
 */
export function sanitizeFsPath(path: string) {
  if (process.platform === "win32" && path[1] === ":") {
    return path[0].toUpperCase() + path.substr(1);
  } else {
    return path;
  }
}

export function resolvePath(path: string, cwd: string): string {
  if (!isAbsolute(path)) path = join(cwd, path);
  return normalize(path);
}
