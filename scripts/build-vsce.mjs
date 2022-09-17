import { spawnSync } from "child_process";
import { readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const rootPath = dirname(dirname(__filename));
const vsc = `${rootPath}/node_modules/vsce/vsce`;
const pkgPath = `${rootPath}/package.json`;
const pkgContents = await readFile(pkgPath);
const pkg = JSON.parse(pkgContents);
const pkgName = pkg.name;

try {
  pkg.name = "phpstan";
  await writePackageFile(pkg);
  spawnSync(
    "node",
    [vsc, "package", "--no-dependencies", "--out", "swordev.phpstan.vsix"],
    {
      stdio: "inherit",
    }
  );
} finally {
  pkg.name = pkgName;
  await writePackageFile(pkg);
}

async function writePackageFile(pkg) {
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}
