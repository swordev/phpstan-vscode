import { Ext } from "../extension";
import { findPHPStanConfigPath as find } from "../utils/phpstan";
import { isAbsolute, join } from "path";

export default async function findPHPStanConfigPath(ext: Ext) {
  const { settings, cwd } = ext;
  const configPath = settings.configPath
    ? isAbsolute(settings.configPath)
      ? settings.configPath
      : join(cwd, settings.configPath)
    : await find(ext.cwd);

  if (!configPath) throw new Error(`Config path not found.`);
  ext.log({ tag: "configPath", message: configPath });
  return configPath;
}
