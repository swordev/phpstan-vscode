const { spawnSync } = require("child_process");
const { readFileSync } = require("fs");
const { join } = require("path");

module.exports = async ({ core }) => {
  const output = {};
  const rootPath = `${__dirname}/../..`;
  const vsceResult = spawnSync(`node`, [
    join(rootPath, "./node_modules/vsce/vsce"),
    "show",
    "swordev.phpstan",
    "--json",
  ]);
  if (vsceResult.error) throw vsceResult.error;
  const vsceJson = JSON.parse(vsceResult.stdout.toString());
  const pkgPath = `${rootPath}/package.json`;
  const pkg = JSON.parse(readFileSync(pkgPath).toString());

  output["currentVersion"] = pkg.version;
  output["publishedVersion"] = vsceJson.versions[0].version;
  output["publish"] = output["currentVersion"] !== output["publishedVersion"];

  for (const name in output) {
    core.setOutput(name, output[name]);
  }

  console.log(output);
};

module.exports({
  core: {
    setOutput: () => {},
  },
});
