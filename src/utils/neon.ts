import { readFile } from "fs/promises";
import { load } from "js-yaml";
import { join, resolve } from "path";

export function resolveNeon(contents: string, env: Record<string, string>) {
  return contents.replace(/(?:%(\w+)%)/g, (_, name) => env[name] ?? "");
}

export async function parseNeonFile<T = unknown>(
  path: string,
  env: Record<string, string> = {}
): Promise<T> {
  const contents = (await readFile(resolve(join(env.currentWorkingDirectory, path)))).toString();
  const yaml = resolveNeon(contents.replace(/\t/g, "  "), env);
  return load(yaml) as Promise<T>;
}
