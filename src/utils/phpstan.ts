import { checkFile } from "./fs";
import { parseYamlFile } from "./yaml";
import { isAbsolute, join, normalize } from "path";

export type PHPStanAnalyseResult = {
  totals: {
    errors: number;
    file_errors: number;
  };
  files: {
    [path: string]: {
      errors: number;
      messages: {
        message: string;
        line: number | null;
        ignorable: boolean;
      }[];
    };
  };
  errors: string[];
};

export type PHPStanConfig = {
  parameters: {
    paths: string[];
    excludes_analyse: string[];
    fileExtensions: string[];
  };
};

export type PHPStanSettings = {
  rootPath: string;
  path: string;
};

function resolveConfigItemValue(
  value: string,
  settings: PHPStanSettings
): string {
  const rootDir = join(settings.rootPath, settings.path);
  return value
    .replace(/%currentWorkingDirectory%/g, settings.rootPath)
    .replace(/%rootDir%/g, rootDir);
}

function resolveConfigItemPath(
  value: string,
  settings: PHPStanSettings
): string {
  value = resolveConfigItemValue(value, settings);
  if (!isAbsolute(value)) value = join(settings.rootPath, value);
  return normalize(value);
}

export function parsePHPStanAnalyseResult(
  stdout: string
): PHPStanAnalyseResult {
  return JSON.parse(stdout);
}

export async function parsePHPStanConfig(
  path: string,
  settings: PHPStanSettings,
  resolve = true
): Promise<PHPStanConfig> {
  const config = await parseYamlFile<PHPStanConfig>(path);
  return resolve ? resolvePHPStanConfig(config, settings) : config;
}

export async function findPHPStanConfigPath(
  settings: PHPStanSettings
): Promise<string | undefined> {
  const dir = settings.rootPath;
  const baseNames = ["phpstan.neon", "phpstan.neon.dist"];
  for (const basename of baseNames) {
    const path = join(dir, basename);
    if (await checkFile(path)) {
      return path;
    }
  }
}

export function resolvePHPStanConfig(
  config: PHPStanConfig,
  settings: PHPStanSettings
): PHPStanConfig {
  config = Object.assign({}, config);
  config.parameters = Object.assign({}, config.parameters);
  const params = config.parameters;
  if (Array.isArray(params.paths))
    params.paths = params.paths.map((v) => resolveConfigItemPath(v, settings));
  if (Array.isArray(params.excludes_analyse))
    params.excludes_analyse = params.excludes_analyse.map((v) =>
      resolveConfigItemPath(v, settings)
    );

  if (!Array.isArray(params.fileExtensions)) params.fileExtensions = [];

  if (!params.fileExtensions.length) params.fileExtensions.push("php");

  return config;
}
