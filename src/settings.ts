import { workspace } from "vscode";

export const EXT_NAME = "phpstan";

export type SettingsType = {
  enabled: boolean;
  path: string;
  phpPath: string;
  configPath: string;
  fileWatcher: boolean;
  configFileWatcher: boolean;
  analysedDelay: number;
  memoryLimit: string;
};

export function getSettings(): SettingsType {
  const config = workspace.getConfiguration(EXT_NAME);
  const get = <T extends keyof SettingsType>(name: T) =>
    config.get(name) as SettingsType[T];
  return {
    enabled: get("enabled"),
    path: get("path"),
    phpPath: get("phpPath"),
    configPath: get("configPath"),
    fileWatcher: get("fileWatcher"),
    configFileWatcher: get("configFileWatcher"),
    analysedDelay: get("analysedDelay"),
    memoryLimit: get("memoryLimit"),
  };
}
