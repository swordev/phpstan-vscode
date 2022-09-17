export function getFunctionName(cb: (...args: never[]) => any) {
  return cb.name.split("$")[0];
}
