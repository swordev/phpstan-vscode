import { EXT_NAME } from "../../settings";
import { State } from "../../state";

export function getCommandName(commandFunction: ($: State) => void) {
  return `${EXT_NAME}.${commandFunction.name}`;
}
