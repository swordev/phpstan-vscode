import getReleasePlan from "@changesets/get-release-plan";
import { spawnSync } from "child_process";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const rootPath = dirname(dirname(__filename));
const vsc = `${rootPath}/node_modules/vsce/vsce`;
const pkgPath = `${rootPath}/package.json`;
const pkgContents = await readFile(pkgPath);
const pkg = JSON.parse(pkgContents.toString());

async function getBranchName() {
  const contents = (await readFile(join(rootPath, ".git/HEAD"))).toString();
  const parts = contents.trim().split("/");
  return parts[parts.length - 1];
}

async function getCommitId(branch) {
  if (!branch) branch = await getBranchName();
  const contents = await readFile(join(rootPath, ".git/refs/heads", branch));
  return contents.toString().trim();
}

async function getNextVersion() {
  const result = await getReleasePlan.default(rootPath);
  const newVersion = result.releases.find(
    (release) => release.name === pkg.name
  )?.newVersion;
  return newVersion
    ? `${newVersion}-${(await getCommitId()).slice(0, 8)}`
    : pkg.version;
}

async function writePackageFile(pkg) {
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

try {
  const newPkg = { ...pkg };
  newPkg.name = "phpstan";
  newPkg.version = await getNextVersion();
  await writePackageFile(newPkg);
  spawnSync(
    "node",
    [
      vsc,
      "package",
      "--no-dependencies",
      "--out",
      `swordev.phpstan-${newPkg.version}.vsix`,
    ],
    {
      stdio: "inherit",
    }
  );
} finally {
  await writePackageFile(pkg);
}
