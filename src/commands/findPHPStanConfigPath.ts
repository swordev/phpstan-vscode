import { Ext } from "../extension";
import { findPHPStanConfigPath as find } from "../utils/phpstan";
import { isAbsolute, join } from "path";

export default async function findPHPStanConfigPath(ext: Ext) {
  const { settings, outputChannel, cwd: rootPath } = ext;
  const configPath = settings.configPath
    ? isAbsolute(settings.configPath)
      ? settings.configPath
      : join(rootPath, settings.configPath)
    : await find({
        cwd: ext.cwd,
        binPath: ext.settings.path,
      });

  if (!configPath) throw new Error(`Config path not found.`);
  outputChannel.appendLine(`# Config path: ${configPath}`);
  return configPath;
}
