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
import { EventEmitter } from "events";
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
  initialAnalysis: boolean;
};

export type ExtStore = {
  phpstan: {
    configPath?: string;
  };
  activate: {
    timeout: DelayedTimeout;
  };
  analyse: {
    channel: EventEmitter;
    timeout: DelayedTimeout;
  };
  fileWatcher: {
    enabled: boolean;
    statusBarFixed?: StatusBarData | undefined;
  };
};

export type StatusBarData = {
  text: string;
  tooltip?: string;
  command?: string | ((ext: Ext) => void);
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
  protected activations = 0;

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
      activate: {
        timeout: createDelayedTimeout(500),
      },
      analyse: {
        timeout: createDelayedTimeout(),
        channel: new EventEmitter(),
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

  log(data: { tag: string; message: string } | string | Buffer | Error) {
    if (typeof data === "string") {
      this.outputChannel.appendLine(data);
    } else if (data instanceof Error) {
      this.log({
        tag: "error",
        message: `${data.stack ?? data.message ?? data}`,
      });
    } else if (Buffer.isBuffer(data)) {
      this.outputChannel.appendLine(uncolorize(data.toString()));
    } else {
      this.outputChannel.appendLine(`# [${data.tag}] ${data.message}`);
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
      this.log({ tag: "call", message: name });
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
      initialAnalysis: get("initialAnalysis"),
    };
  }

  setStatusBar(data: StatusBarData) {
    this.statusBarItem.text = data.text;
    this.statusBarItem.tooltip =
      typeof data.tooltip === "string" ? data.tooltip : undefined;
    if (typeof data.command === "string") {
      this.statusBarItem.command = data.command;
    } else if (typeof data.command === "function") {
      this.statusBarItem.command = this.getCommandName(data.command);
    } else {
      this.statusBarItem.command = undefined;
    }
    this.statusBarItem.show();
  }

  clearStatusBar() {
    if (this.store.fileWatcher.statusBarFixed) {
      this.setStatusBar(this.store.fileWatcher.statusBarFixed);
    } else {
      this.statusBarItem.text = "";
      this.statusBarItem.tooltip = undefined;
      this.statusBarItem.command = undefined;
      this.statusBarItem.hide();
    }
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
    this.activations++;
    await this.call(async () => await this.runActivate(), "activate");
  }

  protected async runActivate() {
    cmd.executeCommand(
      "setContext",
      `${this.options.name}:enabled`,
      this.settings.enabled
    );

    if (!this.settings.enabled) return;

    this.store.phpstan.configPath = await findPHPStanConfigPath(this);

    if (this.settings.configFileWatcher)
      this.fileWatchers.register(
        new RelativePattern(getWorkspacePath(), this.settings.configPath),
        (uri, eventName) => {
          if (!this.store.fileWatcher.enabled) return;
          const path = sanitizeFsPath(uri.fsPath);
          this.log({
            tag: `event:${eventName}`,
            message: path,
          });
          this.store.activate.timeout.run(() => this.reactivate());
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
            this.log({
              tag: `event:${eventName}`,
              message: path,
            });
            await this.call(
              async () => await this.options.commands.analyse(this),
              "analyse"
            );
          }
        }
      });
    }

    if (this.settings.initialAnalysis || this.activations > 1)
      this.options.commands.analyse(this);
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
