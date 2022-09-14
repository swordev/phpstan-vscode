import { State } from "../state";
import { uncolorize } from "../utils/color";
import {
  parsePHPStanAnalyseResult,
  PHPStanAnalyseResult,
} from "../utils/phpstan";
import { killProcess, waitForClose } from "../utils/process";
import { getCommandName } from "../utils/self/command";
import { clearStatusBar, setStatusBarError } from "../utils/self/statusBar";
import showOutput from "./showOutput";
import { spawn } from "child_process";
import { Diagnostic, DiagnosticSeverity, Range, Uri } from "vscode";

function setStatusBarProgress($: State, progress?: number) {
  let text = "$(sync~spin) PHPStan analysing...";
  if (!!progress && progress > 0) text += ` (${progress}%)`;
  $.vscode.statusBarItem.text = text;
  $.vscode.statusBarItem.tooltip = "";
  $.vscode.statusBarItem.command = getCommandName(showOutput);
  $.vscode.statusBarItem.show();
}

async function refreshDiagnostics($: State, result: PHPStanAnalyseResult) {
  $.vscode.diagnostic.clear();

  const globalDiagnostics: Diagnostic[] = [];

  for (const error of result.errors) {
    const range = new Range(0, 0, 0, 0);
    const diagnostic = new Diagnostic(range, error, DiagnosticSeverity.Error);
    globalDiagnostics.push(diagnostic);
  }

  if (globalDiagnostics.length) {
    $.vscode.diagnostic.set(
      Uri.file($.phpstan.configPath ?? "."),
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

    $.vscode.diagnostic.set(Uri.file(path), diagnostics);
  }
}

async function rutine($: State, args?: string[]) {
  setStatusBarProgress($);

  try {
    args = [
      "-f",
      $.settings.path,
      "--",
      "analyse",
      ...($.phpstan.configPath ? ["-c", $.phpstan.configPath] : []),
    ]
      .concat(
        $.settings.memoryLimit
          ? ["--memory-limit=" + $.settings.memoryLimit]
          : []
      )
      .concat(["--error-format=json"])
      .concat(args ?? []);

    const childProcess = ($.process.instance = spawn($.settings.phpPath, args, {
      cwd: $.phpstan.settings.rootPath,
    }));

    childProcess.stdout.on("data", (data: Buffer) =>
      $.vscode.outputChannel.appendLine(uncolorize(data.toString()))
    );

    childProcess.stderr.on("data", (data: Buffer) => {
      const progress = /(\d{1,3})%\s*$/.exec(data.toString())?.[1];
      if (progress) setStatusBarProgress($, Number(progress));
      $.vscode.outputChannel.appendLine(uncolorize(data.toString()));
    });

    const [, stdout] = await waitForClose(childProcess);

    if ($.process.killed) {
      $.process.killed = false;
      return;
    }

    const phpstanResult = parsePHPStanAnalyseResult(stdout);

    refreshDiagnostics($, phpstanResult);
  } catch (error) {
    return setStatusBarError($, error, "Spawn error");
  }

  clearStatusBar($);
}

export async function analyse($: State, ms?: number, args?: string[]) {
  if ($.process.timeout) clearTimeout($.process.timeout);
  $.process.timeout = setTimeout(async () => {
    $.vscode.outputChannel.appendLine("# Command: analyse");
    if ($.process.instance) {
      $.process.killed = true;
      await killProcess($.process.instance);
    }
    await rutine($, args);
    $.process.instance = $.process.killed = null;
  }, ms ?? $.settings.analysedDelay);
}
