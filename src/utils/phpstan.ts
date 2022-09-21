import { checkFile } from "./fs";
import { parseNeonFile } from "./neon";
import { resolvePath } from "./path";
import { join } from "path";

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
  parameters?: {
    paths?: string[];
    excludes_analyse?: string[];
    fileExtensions?: string[];
    bootstrapFiles?: string[];
  };
};

export type PHPStanConfigEnv = {
  rootDir: string;
  currentWorkingDirectory: string;
};

export function parsePHPStanAnalyseResult(
  stdout: string
): PHPStanAnalyseResult {
  return JSON.parse(stdout);
}

export async function parsePHPStanConfigFile(
  path: string,
  env: PHPStanConfigEnv
): Promise<PHPStanConfig> {
  const config = await parseNeonFile<PHPStanConfig>(path, env);
  return normalizePHPStanConfig(config, env.currentWorkingDirectory);
}

export async function findPHPStanConfigPath(
  cwd: string
): Promise<string | undefined> {
  const baseNames = ["phpstan.neon", "phpstan.neon.dist"];
  for (const basename of baseNames) {
    const path = join(cwd, basename);
    if (await checkFile(path)) {
      return path;
    }
  }
}

export function normalizePHPStanConfig(
  config: PHPStanConfig,
  cwd: string
): PHPStanConfig {
  config = Object.assign({}, config);
  config.parameters = Object.assign({}, config.parameters);
  const params = config.parameters;
  const resolve = (v: string) => resolvePath(v, cwd);

  params.paths = params.paths?.map(resolve);
  params.excludes_analyse = params.excludes_analyse?.map(resolve);
  params.bootstrapFiles = params.bootstrapFiles?.map(resolve);

  return config;
}
