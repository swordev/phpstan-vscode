import { State } from "../state";

export default function clearProblems($: State) {
  $.vscode.diagnostic.clear();
}
