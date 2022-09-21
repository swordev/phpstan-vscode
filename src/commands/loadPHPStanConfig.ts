import { Ext } from "../extension";
import { parsePHPStanConfig } from "../utils/phpstan";

export default async function loadPHPStanConfig(ext: Ext) {
  if (!ext.store.phpstan.configPath) throw new Error("Config path is required");
  const config = await parsePHPStanConfig(ext.store.phpstan.configPath, {
    cwd: ext.cwd,
    binPath: ext.settings.path,
  });
  ext.outputChannel.appendLine(`# Config:\n${JSON.stringify(config, null, 2)}`);
  return config;
}
