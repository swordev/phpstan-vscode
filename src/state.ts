import { SettingsType } from "./settings";
import { PHPStanConfig, PHPStanSettings } from "./utils/phpstan";
import { ChildProcessWithoutNullStreams } from "child_process";
import {
  DiagnosticCollection,
  Disposable,
  FileSystemWatcher,
  OutputChannel,
  StatusBarItem,
} from "vscode";

export type State = {
  phpstan: {
    config: PHPStanConfig;
    configPath?: string;
    settings: PHPStanSettings;
  };
  fileWatcherState?: boolean;
  settings: SettingsType;
  vscode: {
    rootPath?: string;
    diagnostic: DiagnosticCollection;
    outputChannel: OutputChannel;
    statusBarItem: StatusBarItem;
    listeners: Disposable[];
    fileWatchers: FileSystemWatcher[];
  };
  process: {
    timeout?: NodeJS.Timeout;
    instance?: ChildProcessWithoutNullStreams | null;
    killed?: boolean | null;
  };
};
