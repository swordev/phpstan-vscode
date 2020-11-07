# phpstan-vscode

[PHPStan](https://phpstan.org) for VSCode.

## Features

- Activates the extension if it detects `phpstan.neon`/`phpstan.neon.dist` file on project root dir.
- Runs PHPStan analyse on every PHP file change.
- Shows all PHPStan problems of whole project.
- Parses PHPStan config for file watching.

## Requirements

```sh
composer require phpstan/phpstan --dev
```

## Contributing

To contribute to the project, follow these steps:

1. Fork this repository.
2. Create a branch: `git checkout -b <branch_name>`.
3. Make your changes and check them: `npm run prepare`.
4. Commit your changes: `git commit -m '<commit_message>'`.
5. Push to the original branch: `git push origin <branch_name>`.
6. Create the pull request.

Alternatively see the GitHub documentation on [creating a pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request).

## License

Distributed under the MIT License. See LICENSE for more information.