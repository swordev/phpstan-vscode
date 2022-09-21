import { sanitizeFsPath } from "./path";
import {
  Disposable,
  FileSystemWatcher,
  RelativePattern,
  Uri,
  workspace,
} from "vscode";

export function getWorkspacePath() {
  const [folder] = workspace.workspaceFolders || [];
  const result = folder ? folder.uri.fsPath : undefined;
  if (!result) throw new Error(`Workspace path is not defined`);
  return sanitizeFsPath(result);
}

export function isDisposable(object: unknown): object is Disposable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!object && typeof (object as any)["dispose"] === "function";
}

export function onFileWatcherEvent(
  watcher: FileSystemWatcher,
  cb: (uri: Uri, eventName: "created" | "deleted" | "changed") => void
) {
  watcher.onDidCreate((uri) => cb(uri, "created"));
  watcher.onDidDelete((uri) => cb(uri, "deleted"));
  watcher.onDidChange((uri) => cb(uri, "changed"));
}

export function onChangeExtensionSettings(extName: string, cb: () => void) {
  return workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(extName)) {
      cb();
    }
  });
}

export type FileWatcherInput =
  | string
  | { extensions: string[] }
  | RelativePattern
  | FileSystemWatcher;
export type FileWatcherCb = (uri: Uri, eventName: string) => void;

export function createFileWatcher(input: FileWatcherInput, cb: FileWatcherCb) {
  const watcher =
    typeof input === "string" || input instanceof RelativePattern
      ? workspace.createFileSystemWatcher(input)
      : isDisposable(input)
      ? input
      : workspace.createFileSystemWatcher(
          `**/*.{${input.extensions.join(",")}}`
        );

  onFileWatcherEvent(watcher, cb);

  return watcher;
}

export function createFileExtensionWatcher(options: {
  extensions: string[];
  onPaths: () => string[];
  onMatch: (uri: Uri, eventName: string) => void;
}) {
  return createFileWatcher(
    `**/*.{${options.extensions.join(",")}}`,
    (uri, eventName) => {
      const subjectPath = sanitizeFsPath(uri.fsPath);
      const found = options
        .onPaths()
        .some((patternPath) => subjectPath.startsWith(patternPath));
      if (found) return options.onMatch(uri, eventName);
    }
  );
}

export function createFileWatcherManager() {
  let fileWatchers: FileSystemWatcher[] = [];
  return {
    register: (input: FileWatcherInput, cb: FileWatcherCb) => {
      return fileWatchers.push(createFileWatcher(input, cb));
    },
    dispose: () => {
      fileWatchers.forEach((v) => v.dispose());
      fileWatchers = [];
    },
  };
}
