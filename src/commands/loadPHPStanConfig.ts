import { Ext } from "../extension";
import { parsePHPStanConfigFile } from "../utils/phpstan";

export default async function loadPHPStanConfig(ext: Ext) {
  if (!ext.store.phpstan.configPath) throw new Error("Config path is required");
  const config = await parsePHPStanConfigFile(ext.store.phpstan.configPath, {
    currentWorkingDirectory: ext.cwd,
  });
  ext.log({ tag: "config", message: JSON.stringify(config, null, 2) });
  return config;
}
