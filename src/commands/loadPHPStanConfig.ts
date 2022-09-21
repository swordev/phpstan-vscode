import { Ext } from "../extension";
import { parsePHPStanConfigFile } from "../utils/phpstan";
import { dirname, join, normalize } from "path";

export default async function loadPHPStanConfig(ext: Ext) {
  if (!ext.store.phpstan.configPath) throw new Error("Config path is required");
  const config = await parsePHPStanConfigFile(ext.store.phpstan.configPath, {
    currentWorkingDirectory: ext.cwd,
    rootDir: normalize(dirname(join(ext.cwd, ext.settings.path))),
  });
  ext.outputChannel.appendLine(`# Config:\n${JSON.stringify(config, null, 2)}`);
  return config;
}
