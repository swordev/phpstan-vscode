export function getFunctionName(cb: (...args: never[]) => unknown) {
  return cb.name.split("$")[0];
}
