import findPHPStanConfigPath from "./commands/findPHPStanConfigPath";
import loadPHPStanConfig from "./commands/loadPHPStanConfig";
import { createDelayedTimeout, DelayedTimeout } from "./utils/async";
import { uncolorize } from "./utils/color";
import { getFunctionName } from "./utils/function";
import { sanitizeFsPath } from "./utils/path";
import {
  createFileWatcherManager,
  getWorkspacePath,
  onChangeExtensionSettings,
} from "./utils/vscode";
import { ChildProcessWithoutNullStreams } from "child_process";
import {
  DiagnosticCollection,
  Disposable,
  OutputChannel,
  StatusBarItem,
  commands as cmd,
  window,
  languages,
  workspace,
  RelativePattern,
} from "vscode";

export type ExtCommand = (ext: Ext) => unknown;

export type ExtSettings = {
  enabled: boolean;
  path: string;
  phpPath: string;
  configPath: string;
  fileWatcher: boolean;
  configFileWatcher: boolean;
  analysedDelay: number;
  memoryLimit: string;
};

export type ExtStore = {
  phpstan: {
    configPath?: string;
  };
  reactivate: {
    timeout: DelayedTimeout;
  };
  analyse: {
    process?: ChildProcessWithoutNullStreams;
    timeout: DelayedTimeout;
  };
  fileWatcher: {
    enabled: boolean;
  };
};

export class Ext<
  T extends { analyse: ExtCommand; showOutput: ExtCommand } = {
    analyse: ExtCommand;
    showOutput: ExtCommand;
  }
> {
  readonly settings: ExtSettings;
  readonly store: ExtStore;
  readonly cwd: string;
  readonly outputChannel: OutputChannel;
  readonly settingsListener: Disposable;
  readonly diagnostic: DiagnosticCollection;
  readonly statusBarItem: StatusBarItem;
  readonly commandListeners: Disposable[] = [];
  protected fileWatchers = createFileWatcherManager();

  constructor(
    readonly options: {
      name: string;
      commands: T;
    }
  ) {
    const { name } = this.options;
    this.settings = this.readSettings();
    this.cwd = getWorkspacePath();
    this.outputChannel = window.createOutputChannel(name);
    this.diagnostic = languages.createDiagnosticCollection(name);
    this.statusBarItem = window.createStatusBarItem();
    this.settingsListener = onChangeExtensionSettings(name, () => {
      (this as { settings: ExtSettings }).settings = this.readSettings();
      this.reactivate();
    });
    this.store = {
      phpstan: {},
      reactivate: {
        timeout: createDelayedTimeout(500),
      },
      analyse: {
        timeout: createDelayedTimeout(),
      },
      fileWatcher: {
        enabled: true,
      },
    };

    for (const name in this.options.commands) {
      const command = this.options.commands[name] as ExtCommand;
      this.registerCommand(name, command);
    }
  }

  log(data: string | Buffer | Error) {
    if (typeof data === "string") {
      this.outputChannel.appendLine(data);
    } else if (data instanceof Error) {
      this.outputChannel.appendLine(
        `# [error] ${data.stack ?? data.message ?? data}`
      );
    } else {
      this.outputChannel.appendLine(uncolorize(data.toString()));
    }
  }

  registerCommand(name: string, command: ExtCommand) {
    const listener = cmd.registerCommand(`${this.options.name}.${name}`, () => {
      this.call(() => command(this), name);
    });
    this.commandListeners.push(listener);
    return listener;
  }

  async call(cb: () => unknown, name = getFunctionName(cb)) {
    try {
      this.log(`[call:${name}]`);
      return await cb();
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e: Error = error as any;
      this.setStatusBarError(error, name);
      this.log(e);
    }
  }

  readSettings(): ExtSettings {
    const config = workspace.getConfiguration(this.options.name);
    const get = <T extends keyof ExtSettings>(name: T) =>
      config.get(name) as ExtSettings[T];
    return {
      enabled: get("enabled"),
      path: get("path"),
      phpPath: get("phpPath"),
      configPath: get("configPath"),
      fileWatcher: get("fileWatcher"),
      configFileWatcher: get("configFileWatcher"),
      analysedDelay: get("analysedDelay"),
      memoryLimit: get("memoryLimit"),
    };
  }

  clearStatusBar() {
    this.statusBarItem.text = "";
    delete this.statusBarItem.tooltip;
    delete this.statusBarItem.command;
    this.statusBarItem.hide();
  }

  setStatusBarError(error: unknown, source: string) {
    const errorMessage =
      error instanceof Error ? error.message : new String(error).toString();
    const { statusBarItem } = this;
    statusBarItem.text = `$(error) PHPStan`;
    statusBarItem.tooltip = `${source}: ${errorMessage}`;
    statusBarItem.command = this.getCommandName(
      this.options.commands.showOutput
    );
    statusBarItem.show();
    return false;
  }

  getCommandName(command: ExtCommand) {
    return `${this.options.name}.${getFunctionName(command)}`;
  }

  async reactivate() {
    this.fileWatchers.dispose();
    await this.activate();
  }

  async activate() {
    await this.call(async () => await this.activateRutine(), "activate");
  }

  protected async activateRutine(analyse = true) {
    cmd.executeCommand(
      "setContext",
      `${this.options.name}:enabled`,
      this.settings.enabled
    );

    if (!this.settings.enabled) return;

    this.store.phpstan.configPath = await findPHPStanConfigPath(this);

    if (this.settings.configFileWatcher)
      this.fileWatchers.register(
        this.settings.configPath ??
          new RelativePattern(this.cwd, `{phpstan.neon,phpstan.neon.dist}`),
        (uri, eventName) => {
          if (!this.store.fileWatcher.enabled) return;
          const path = sanitizeFsPath(uri.fsPath);
          this.log(`[event:${eventName}] ${path}`);
          this.store.reactivate.timeout(() => this.reactivate());
        }
      );

    if (this.settings.fileWatcher) {
      const config = await loadPHPStanConfig(this);
      const extensions = config.parameters?.fileExtensions ?? ["php"];
      this.fileWatchers.register({ extensions }, async (uri, eventName) => {
        if (!this.store.fileWatcher.enabled) return;
        for (const patternPath of config.parameters?.paths || []) {
          const path = sanitizeFsPath(uri.fsPath);
          if (path.startsWith(patternPath)) {
            this.log(`[event:${eventName}] ${path}`);
            return await this.options.commands.analyse(this);
          }
        }
      });
    }

    if (analyse) this.options.commands.analyse(this);
  }

  deactivate() {
    if (this.outputChannel) {
      this.outputChannel.clear();
      this.outputChannel.dispose();
    }
    if (this.settingsListener) {
      this.settingsListener.dispose();
    }
    if (this.diagnostic) {
      this.diagnostic.clear();
      this.diagnostic.dispose();
    }
    if (this.statusBarItem) {
      this.statusBarItem.hide();
      this.statusBarItem.dispose();
    }
    this.commandListeners.forEach((v) => v.dispose);
    this.fileWatchers.dispose();
    cmd.executeCommand("setContext", `${this.options.name}:enabled`, false);
  }
}
