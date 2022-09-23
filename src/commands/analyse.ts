import { Ext } from "../extension";
import {
  parsePHPStanAnalyseResult,
  PHPStanAnalyseResult,
} from "../utils/phpstan";
import { waitForClose } from "../utils/process";
import showOutput from "./showOutput";
import stopAnalyse from "./stopAnalyse";
import { spawn } from "child_process";
import { Diagnostic, DiagnosticSeverity, Range, Uri } from "vscode";

function setStatusBarProgress(ext: Ext, progress?: number) {
  const { statusBarItem } = ext;
  let text = "$(sync~spin) PHPStan analysing...";
  if (!!progress && progress > 0) text += ` (${progress}%)`;

  statusBarItem.text = text;
  statusBarItem.tooltip = "";
  statusBarItem.command = ext.getCommandName(showOutput);
  statusBarItem.show();
}

async function refreshDiagnostics(ext: Ext, result: PHPStanAnalyseResult) {
  const { diagnostic } = ext;
  diagnostic.clear();

  const globalDiagnostics: Diagnostic[] = [];

  for (const error of result.errors) {
    const range = new Range(0, 0, 0, 0);
    const diagnostic = new Diagnostic(range, error, DiagnosticSeverity.Error);
    globalDiagnostics.push(diagnostic);
  }

  if (globalDiagnostics.length) {
    ext.diagnostic.set(
      Uri.file(ext.store.phpstan.configPath ?? "."),
      globalDiagnostics
    );
  }

  // https://github.com/phpstan/phpstan-src/blob/6d228a53/src/Analyser/MutatingScope.php#L289
  const contextRegex = / \(in context of .+\)$/;

  for (let path in result.files) {
    const pathItem = result.files[path];
    const diagnostics: Diagnostic[] = [];
    for (const messageItem of pathItem.messages) {
      const line = messageItem.line ? messageItem.line - 1 : 0;
      const range = new Range(line, 0, line, 0);
      const diagnostic = new Diagnostic(
        range,
        messageItem.message,
        DiagnosticSeverity.Error
      );

      diagnostics.push(diagnostic);
    }

    const matches = contextRegex.exec(path);

    if (matches) path = path.slice(0, matches.index);

    diagnostic.set(Uri.file(path), diagnostics);
  }
}

async function rutine(ext: Ext, args?: string[]) {
  setStatusBarProgress(ext);

  const childProcess = (ext.store.analyse.process = spawn(
    ext.settings.phpPath,
    [
      "-f",
      ext.settings.path,
      "--",
      "analyse",
      ...(ext.store.phpstan.configPath
        ? ["-c", ext.store.phpstan.configPath]
        : []),
      ...(ext.settings.memoryLimit
        ? [`--memory-limit=${ext.settings.memoryLimit}`]
        : []),
      "--error-format=json",
      ...(args ?? []),
    ],
    {
      cwd: ext.cwd,
    }
  ));

  childProcess.stdout.on("data", (buffer: Buffer) => ext.log(buffer));

  childProcess.stderr.on("data", (buffer: Buffer) => {
    const progress = /(\d{1,3})%\s*$/.exec(buffer.toString())?.[1];
    if (progress) setStatusBarProgress(ext, Number(progress));
    ext.log(buffer);
  });

  const [, stdout] = await waitForClose(childProcess);

  ext.store.analyse.process = undefined;

  const phpstanResult = parsePHPStanAnalyseResult(stdout);

  refreshDiagnostics(ext, phpstanResult);

  ext.clearStatusBar();
}

export default async function analyse(ext: Ext, ms?: number, args?: string[]) {
  await stopAnalyse(ext);
  ext.store.analyse.timeout.run(async () => {
    await rutine(ext, args);
  }, ms ?? ext.settings.analysedDelay);
}
