import { promises as fs } from "fs";

export async function checkFile(path: string): Promise<boolean> {
  try {
    return !!(await fs.stat(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
