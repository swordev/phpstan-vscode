# phpstan-vscode

[![version]](https://marketplace.visualstudio.com/items?itemName=swordev.phpstan) [![ci]](https://github.com/swordev/phpstan-vscode/actions/workflows/ci.yml) [![downloads]](https://marketplace.visualstudio.com/items?itemName=swordev.phpstan)

[ci]: https://img.shields.io/github/workflow/status/swordev/phpstan-vscode/CI?label=CI
[version]: https://img.shields.io/visual-studio-marketplace/v/swordev.phpstan?logo=
[downloads]: https://img.shields.io/visual-studio-marketplace/d/swordev.phpstan

[PHPStan](https://phpstan.org) extension for VSCode.

> Analyzes your PHP project manually or on every file change with PHPStan and shows the result in the VSCode problems tab.

## Features

- Runs PHPStan analyse on every PHP file change.
- Shows all PHPStan problems of the whole project.
- Parses the PHPStan config file for configuring the extension.
- Commands:
  - `phpstan.showOutput`: show output.
  - `phpstan.analyse`: analyse.
  - `phpstan.analyseCurrentPath`: analyse current path.
    - Also available in the explorer context menu.
  - `phpstan.stopAnalyse`: stop analyse.
  - `phpstan.pauseFileWatcher`: pause file watcher.
  - `phpstan.resumeFileWatcher`: resume file watcher.
  - `phpstan.toggleFileWatcher`: toggle file watcher.
  - `phpstan.clearProblems`: clear problems.
  - `phpstan.clearCache`: clear cache.

## Usage

1. Install [PHPStan extension](https://marketplace.visualstudio.com/items?itemName=swordev.phpstan).
2. Provide a [phpstan.neon](https://phpstan.org/config-reference#neon-format) file on the project root dir.
3. Install PHPStan on the project.

```sh
composer require phpstan/phpstan --dev
```

## Contributing

To contribute to the project, follow these steps:

1. Fork this repository.
2. Create a branch: `git checkout -b <branch_name>`.
3. Make your changes and check them: `pnpm changeset`.
4. Commit your changes: `git commit -m '<commit_message>'`.
5. Push to the original branch: `git push origin <branch_name>`.
6. Create the pull request.

Alternatively see the GitHub documentation on [creating a pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request).

## License

Distributed under the MIT License. See LICENSE for more information.
