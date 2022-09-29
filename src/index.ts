import { commands } from "./commands";
import { Ext } from "./extension";
import { waitForWorkspaceReady } from "./utils/vscode";

let ext: Ext | undefined;

export const name = "phpstan";

export function activate(): void {
  ext = new Ext({
    name,
    commands,
  });
  waitForWorkspaceReady(ext.cwd, {
    tries: 30,
    tryTimeout: 1000,
    onTry: (tryNumber) => {
      ext?.log({
        tag: "activate",
        message: `Waiting for workspace to be ready (${tryNumber})`,
      });
    },
  })
    .then(() => ext?.activate())
    .catch((error) => ext?.log(error));
}

export function deactivate(): void {
  ext?.deactivate();
  ext = undefined;
}
