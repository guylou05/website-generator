export const TERMINAL_DEPLOYMENT_STATUSES = new Set([
  'succeeded',
  'failed',
  'partially_succeeded',
  'cancelled',
]);

/** Refreshes serially: the next timer is not scheduled until the request settles. */
export function pollDeployment<T extends { status: string }>(options: {
  load: (signal: AbortSignal) => Promise<T>;
  onData: (value: T) => void;
  onError: (error: unknown) => void;
  delay?: number;
}) {
  let stopped = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  const run = async () => {
    controller = new AbortController();
    try {
      const value = await options.load(controller.signal);
      if (stopped) return;
      failures = 0;
      options.onData(value);
      if (TERMINAL_DEPLOYMENT_STATUSES.has(value.status)) return;
    } catch (error) {
      if (stopped) return;
      failures += 1;
      options.onError(error);
    }
    if (!stopped)
      timer = setTimeout(
        run,
        Math.min(
          30_000,
          (options.delay ?? 2500) * 2 ** Math.max(0, failures - 1),
        ),
      );
  };
  void run();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
  };
}
