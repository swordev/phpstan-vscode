import * as fs from "fs";
import * as readline from "readline";

export async function checkFile(path: string): Promise<boolean> {
  try {
    return !!(await fs.promises.stat(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function getFileLines(path: string): Promise<string[]> {
  if (!checkFile(path)) {
    return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
    try {
      const stream = fs.createReadStream(path);
      
      const rl = readline.createInterface({
          input: stream,
      });

      const lines: string[] = [];

      rl.on('line', (line) => {
        lines.push(line);
      });
      
      rl.on('close', () => {
        resolve(lines);
      });
    } catch (err) {
      reject(err);
    }
  });
}
