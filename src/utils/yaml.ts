import { promises as fs } from "fs";
import { parse } from "yaml";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseYamlFile<T = any>(path: string): Promise<T> {
  let contents = (await fs.readFile(path)).toString();
  contents = contents.replace(/\t/g, "  ");
  return parse(contents);
}
