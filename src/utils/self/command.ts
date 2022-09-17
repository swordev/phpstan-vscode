import { EXT_NAME } from "../../settings";
import { State } from "../../state";
import { getFunctionName } from "../function";

export function getCommandName(commandFunction: ($: State) => void) {
  return `${EXT_NAME}.${getFunctionName(commandFunction)}`;
}
