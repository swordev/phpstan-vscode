import { Ext } from "../extension";
import { RelativePattern, workspace } from "vscode";

export default async function findPHPStanConfigPath(ext: Ext) {
  const { settings, cwd } = ext;
  const [configUri] = await workspace.findFiles(
    new RelativePattern(cwd, settings.configPath),
    null,
    1
  );
  if (!configUri) throw new Error(`Config path not found.`);
  const configPath = configUri.fsPath;
  ext.log({ tag: "configPath", message: configPath });
  return configPath;
}
