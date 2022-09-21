import { commands } from "./commands";
import { Ext } from "./extension";

let ext: Ext | undefined;

export const name = "phpstan";

export function activate(): void {
  ext = new Ext({
    name,
    commands,
  });
  ext.activate();
}

export function deactivate(): void {
  ext?.deactivate();
  ext = undefined;
}
