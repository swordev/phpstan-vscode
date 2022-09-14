import { State } from "../state";
import {
  findPHPStanConfigPath,
  parsePHPStanConfig,
  PHPStanConfig,
} from "../utils/phpstan";
import { setStatusBarError } from "../utils/self/statusBar";
import { isAbsolute, join } from "path";

export default async function loadPHPStanConfig($: State) {
  if (!$.phpstan.configPath)
    return setStatusBarError(
      $,
      new Error("Config path is required"),
      "Parse config error"
    );
  const config = await parsePHPStanConfig(
    $.phpstan.configPath,
    $.phpstan.settings
  );
  $.vscode.outputChannel.appendLine(
    `# Config:\n${JSON.stringify(config, null, 2)}`
  );
  return true;
}
