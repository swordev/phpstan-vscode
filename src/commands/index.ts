import analyse from "./analyse";
import analyseCurrentPath from "./analyseCurrentPath";
import { clearCache } from "./clearCache";
import clearProblems from "./clearProblems";
import findPHPStanConfigPath from "./findPHPStanConfigPath";
import loadPHPStanConfig from "./loadPHPStanConfig";
import pauseFileWatcher from "./pauseFileWatcher";
import resumeFileWatcher from "./resumeFileWatcher";
import showOutput from "./showOutput";
import stopAnalyse from "./stopAnalyse";
import toggleFileWatcher from "./toggleFileWatcher";

export const commands = {
  analyse,
  analyseCurrentPath,
  clearCache,
  clearProblems,
  findPHPStanConfigPath,
  loadPHPStanConfig,
  pauseFileWatcher,
  resumeFileWatcher,
  showOutput,
  stopAnalyse,
  toggleFileWatcher,
};
export default commands;
