import commands from "./commands";
import { analyse } from "./commands/analyse";
import findPHPStanConfigPath from "./commands/findPHPStanConfigPath";
import loadPHPStanConfig from "./commands/loadPHPStanConfig";
import { EXT_NAME, getSettings } from "./settings";
import { State } from "./state";
import { sanitizeFsPath } from "./utils/path";
import { getCommandName } from "./utils/self/command";
import { setStatusBarError } from "./utils/self/statusBar";
import {
  getWorkspacePath,
  onChangeExtensionSettings,
  onFileWatcherEvent,
} from "./utils/vscode";
import {
  Disposable,
  ExtensionContext,
  languages,
  RelativePattern,
  window,
  workspace,
  commands as cmd,
  Uri,
} from "vscode";

let initTimeout: NodeJS.Timeout;

const $: State = {
  process: {},
  settings: null as any,
  fileWatcherState: true,
  vscode: {
    fileWatchers: [],
    listeners: [],
    diagnostic: null as any,
    outputChannel: null as any,
    statusBarItem: null as any,
  },
  phpstan: {
    config: {
      parameters: {
        excludes_analyse: [],
        fileExtensions: [],
        paths: [],
      },
    },
    settings: {
      path: ".",
      rootPath: ".",
    },
  },
};

async function safeCall(cb: () => unknown, name?: string) {
  try {
    return await cb();
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e: Error = error as any;
    setStatusBarError($, error, name ?? cb.name);
    $.vscode.outputChannel.appendLine(`# Error: ${e.stack ?? e.message ?? e}`);
  }
}

async function init() {
  $.vscode.fileWatchers.map((w) => w.dispose());
  $.vscode.fileWatchers = [];
  $.vscode.outputChannel.appendLine("# Init");

  if (!$.vscode.rootPath)
    return $.vscode.outputChannel.appendLine(`'rootPath' is not defined.`);

  $.phpstan.configPath = await findPHPStanConfigPath($);
  if ($.settings.configFileWatcher) enableConfigFileWatcher();

  await loadPHPStanConfig($);

  if ($.settings.fileWatcher) {
    $.vscode.fileWatchers.push(createFileWatcher());
  }

  analyse($, 0);
}

function enableConfigFileWatcher() {
  const run = async (uri: Uri, eventName: string) => {
    if (!$.fileWatcherState) return;
    const fsPath = sanitizeFsPath(uri.fsPath);
    $.vscode.outputChannel.appendLine(`# Config file ${eventName}: ${fsPath}`);
    clearTimeout(initTimeout);
    initTimeout = setTimeout(async () => await safeCall(init), 250);
  };

  const configFileWatchers: typeof $.vscode.fileWatchers = [];

  if ($.settings.configPath) {
    configFileWatchers.push(
      workspace.createFileSystemWatcher($.settings.configPath)
    );
  } else {
    configFileWatchers.push(
      workspace.createFileSystemWatcher(
        new RelativePattern(
          $.vscode.rootPath!,
          `{phpstan.neon,phpstan.neon.dist}`
        )
      )
    );
  }

  for (const watcher of configFileWatchers) {
    onFileWatcherEvent(watcher, run);
  }

  $.vscode.fileWatchers.push(...configFileWatchers);
}

export function activate(context: ExtensionContext): void {
  $.settings = getSettings();
  $.vscode.rootPath = getWorkspacePath();
  $.vscode.listeners = [
    onChangeExtensionSettings(EXT_NAME, () => {
      $.vscode.outputChannel?.appendLine(`# Reload`);
      deactivate({
        exclude: [$.vscode.outputChannel],
      });
      activate(context);
    }),
  ];

  if (!$.settings.enabled || !$.vscode.rootPath) {
    deactivate({
      include: [$.vscode.outputChannel],
    });
    return;
  }

  cmd.executeCommand("setContext", `${EXT_NAME}:enabled`, true);

  $.phpstan.settings.path = $.settings.path;
  $.phpstan.settings.rootPath = sanitizeFsPath($.vscode.rootPath);

  if (!$.vscode.outputChannel)
    $.vscode.outputChannel = window.createOutputChannel(EXT_NAME);

  $.vscode.outputChannel?.appendLine(`# Load`);
  $.vscode.diagnostic = languages.createDiagnosticCollection(EXT_NAME);
  $.vscode.statusBarItem = window.createStatusBarItem();

  for (const command of commands)
    $.vscode.listeners.push(
      cmd.registerCommand(getCommandName(command), () => {
        safeCall(() => command($), command.name);
      })
    );

  safeCall(init);
}

export function deactivate(filter: {
  include?: Disposable[];
  exclude?: Disposable[];
}): void {
  const cb = (v: Disposable) => {
    if (filter.include && !filter.include.includes(v)) return false;
    if (filter.exclude && filter.exclude.includes(v)) return false;
    v.dispose();
    return true;
  };

  $.vscode.fileWatchers = $.vscode.fileWatchers.filter(cb);
  $.vscode.listeners = $.vscode.listeners.filter(cb);
  $.vscode.diagnostic = cb($.vscode.diagnostic)
    ? $.vscode.diagnostic
    : (undefined as any);
  $.vscode.outputChannel = cb($.vscode.outputChannel)
    ? $.vscode.outputChannel
    : (undefined as any);
  $.vscode.statusBarItem = cb($.vscode.statusBarItem)
    ? $.vscode.statusBarItem
    : (undefined as any);

  cmd.executeCommand("setContext", `${EXT_NAME}:enabled`, false);
}

function createFileWatcher() {
  const watcher = workspace.createFileSystemWatcher(
    `**/*.{${$.phpstan.config.parameters.fileExtensions.join(",")}}`
  );

  onFileWatcherEvent(watcher, async (uri, eventName) => {
    if (!$.fileWatcherState) return;
    for (const path of $.phpstan.config.parameters.paths) {
      const fsPath = sanitizeFsPath(uri.fsPath);
      if (fsPath.startsWith(path)) {
        $.vscode.outputChannel.appendLine(`# File ${eventName}: ${fsPath}`);
        return await analyse($);
      }
    }
  });

  return watcher;
}
