const sensitive = /authorization|token|api.?key|password|secret|credential/i;
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        sensitive.test(k) ? '[REDACTED]' : redact(v),
      ]),
    );
  return value;
}
export const logger = {
  info(message: string, context: Record<string, unknown> = {}): void {
    console.info(
      JSON.stringify({
        level: 'info',
        message,
        ...(redact(context) as object),
      }),
    );
  },
  error(message: string, context: Record<string, unknown> = {}): void {
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        ...(redact(context) as object),
      }),
    );
  },
};
