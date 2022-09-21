import { readFile } from "fs/promises";
import { load } from "js-yaml";

export function resolveNeon(contents: string, env: Record<string, string>) {
  return contents.replace(/(?:%(\w+)%)/g, (_, name) => env[name] ?? "");
}

export async function parseNeonFile<T = unknown>(
  path: string,
  env: Record<string, string> = {}
): Promise<T> {
  const contents = (await readFile(path)).toString();
  const yaml = resolveNeon(contents.replace(/\t/g, "  "), env);
  return load(yaml) as Promise<T>;
}
