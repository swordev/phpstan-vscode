import { Ext } from "../extension";
import {
  parsePHPStanAnalyseResult,
  PHPStanAnalyseResult,
} from "../utils/phpstan";
import { killProcess, waitForClose } from "../utils/process";
import showOutput from "./showOutput";
import stopAnalyse from "./stopAnalyse";
import { spawn } from "child_process";
import { Diagnostic, DiagnosticSeverity, Range, Uri } from "vscode";

function setStatusBarProgress(ext: Ext, progress?: number) {
  let text = "$(sync~spin) PHPStan analysing...";
  if (!!progress && progress > 0) text += ` (${progress}%)`;

  ext.setStatusBar({ text, command: showOutput });
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

async function runAnalyse(ext: Ext, args?: string[]) {
  setStatusBarProgress(ext);

  const childProcess = spawn(
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
  );

  let stdout = "";
  let skipCloseError = false;
  const { channel } = ext.store.analyse;

  channel.once("stop", async () => {
    skipCloseError = true;
    try {
      const killed = await killProcess(childProcess);
      ext.log({
        tag: "call",
        message: `killProcess (${killed ? "true" : "false"})`,
      });
    } catch (error) {
      ext.log(error as Error);
    }
  });

  try {
    childProcess.stdout.on("data", (buffer: Buffer) => {
      stdout += buffer.toString();
      ext.log(buffer);
    });
    childProcess.stderr.on("data", (buffer: Buffer) => {
      const progress = /(\d{1,3})%\s*$/.exec(buffer.toString())?.[1];
      if (progress) setStatusBarProgress(ext, Number(progress));
      ext.log(buffer);
    });
    try {
      await waitForClose(childProcess);
    } catch (error) {
      if (skipCloseError) {
        ext.clearStatusBar();
        return;
      }
      throw error;
    }
  } finally {
    channel.removeAllListeners();
  }

  if (stdout) {
    const phpstanResult = parsePHPStanAnalyseResult(stdout);
    refreshDiagnostics(ext, phpstanResult);
  }

  ext.clearStatusBar();
}

export default async function analyse(ext: Ext, ms?: number, args?: string[]) {
  stopAnalyse(ext);
  ext.store.analyse.timeout.run(async () => {
    await runAnalyse(ext, args);
  }, ms ?? ext.settings.analysedDelay);
}
