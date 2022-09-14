import { State } from "../state";
import pauseFileWatcher from "./pauseFileWatcher";
import resumeFileWatcher from "./resumeFileWatcher";

export default function toggleFileWatcher($: State) {
  $.fileWatcherState ? pauseFileWatcher($) : resumeFileWatcher($);
}
