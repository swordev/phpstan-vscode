export type DelayedTimeout = (cb: () => unknown, ms?: number) => void;

export function createDelayedTimeout(defaultsMs?: number) {
  let timeout: NodeJS.Timeout | undefined;
  return (cb: () => unknown, ms = defaultsMs) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(cb, ms);
  };
}
