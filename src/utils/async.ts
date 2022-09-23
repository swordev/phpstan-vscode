export type DelayedTimeout = {
  readonly running: boolean;
  readonly pending: boolean;
  run: (cb: () => unknown, ms?: number) => void;
};

export function createDelayedTimeout(defaultsMs?: number) {
  let timeout: NodeJS.Timeout | undefined;
  let running = false;
  let pending = false;
  return {
    get pending() {
      return pending;
    },
    get running() {
      return running;
    },
    run: (cb: () => unknown, ms = defaultsMs) => {
      pending = true;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        running = true;
        try {
          await cb();
        } finally {
          running = pending = false;
        }
      }, ms);
    },
  };
}
