import { State } from "../state";

export default function showOutput($: State) {
  $.vscode.outputChannel.show();
}
