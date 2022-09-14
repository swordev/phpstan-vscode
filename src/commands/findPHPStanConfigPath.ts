import { State } from "../state";
import { findPHPStanConfigPath as find } from "../utils/phpstan";
import { isAbsolute, join } from "path";

export default async function findPHPStanConfigPath($: State) {
  const configPath = $.settings.configPath
    ? isAbsolute($.settings.configPath)
      ? $.settings.configPath
      : join($.phpstan.settings.rootPath, $.settings.configPath)
    : await find($.phpstan.settings);

  if (!configPath) throw new Error(`Config path not found.`);
  $.vscode.outputChannel.appendLine(`# Config path: ${configPath}`);
  return configPath;
}
