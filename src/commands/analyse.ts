import { normalize, resolve } from "path";
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
import { getFileLines } from "../utils/fs";

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
    diagnostic.source = ext.options.name;
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

  const pathMaps: {
    src: string,
    dest: string,
  }[] = [];

  ext.settings.pathMappings.split(',').map(mapping => {
    const parts = mapping.split(':').map(p => p.trim()).map(p => p.length > 0 ? p : '.').map(normalize);
    if (parts.length === 2 && parts[0] && parts[1]) {
      pathMaps.push({
        src: parts[0] + '/',
        dest: parts[1] + '/',
      });
    }
  });

  ext.log('Using path mappings: ' + JSON.stringify(pathMaps));

  for (const path in result.files) {
    let realPath = path;

    const matches = contextRegex.exec(realPath);

    if (matches) realPath = realPath.slice(0, matches.index);

    realPath = normalize(realPath);

    for (const pathMap of pathMaps) {
      if (realPath.startsWith(pathMap.src)) {
        realPath = resolve(ext.cwd, pathMap.dest + realPath.substring(pathMap.src.length));
        break;
      }
    }

    const fileLines: string[] = await getFileLines(resolve(realPath));

    const pathItem = result.files[path];
    const diagnostics: Diagnostic[] = [];
    for (const messageItem of pathItem.messages) {
      const line = messageItem.line ? messageItem.line - 1 : 0;
      const lineText = messageItem.line ? (fileLines[line] ?? '') : '';

      const startCol = Math.max(0, lineText.search(/[^\s]/g));
      const endCol = Math.max(0, lineText.search(/\s*$/g));

      const range = new Range(line, startCol, line, endCol);
      const diagnostic = new Diagnostic(
        range,
        messageItem.message,
        DiagnosticSeverity.Error
      );
      diagnostic.source = ext.options.name;

      diagnostics.push(diagnostic);
    }

    diagnostic.set(Uri.file(realPath), diagnostics);
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
