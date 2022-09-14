import { State } from "../state";
import { analyse } from "./analyse";

export default function resumeFileWatcher($: State) {
  $.fileWatcherState = true;
  analyse($);
}
