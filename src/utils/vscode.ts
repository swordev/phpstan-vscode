import { Disposable, FileSystemWatcher, Uri, workspace } from "vscode";

export function getWorkspacePath() {
  const [folder] = workspace.workspaceFolders || [];
  return folder ? folder.uri.fsPath : undefined;
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
