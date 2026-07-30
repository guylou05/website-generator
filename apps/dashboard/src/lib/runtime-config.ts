function trimUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}

type PublicRuntimeEnvironment = Readonly<
  Record<
    'NEXT_PUBLIC_API_URL' | 'NEXT_PUBLIC_USE_PROXY' | 'NODE_ENV',
    string | undefined
  >
>;

export function browserApiBase(
  env?: Partial<PublicRuntimeEnvironment>,
): string {
  // Keep these direct references: Next.js replaces NEXT_PUBLIC_* expressions at
  // build time, while dynamic access through a process.env object is not inlined.
  const useProxy = env
    ? env.NEXT_PUBLIC_USE_PROXY
    : process.env.NEXT_PUBLIC_USE_PROXY;
  const publicUrl = env
    ? env.NEXT_PUBLIC_API_URL
    : process.env.NEXT_PUBLIC_API_URL;
  const nodeEnv = env ? env.NODE_ENV : process.env.NODE_ENV;

  if (isEnabled(useProxy)) return '/api/proxy';

  if (nodeEnv === 'production' && publicUrl?.startsWith('/api/proxy')) {
    throw new Error(
      'Invalid dashboard configuration: NEXT_PUBLIC_USE_PROXY must be true when NEXT_PUBLIC_API_URL uses /api/proxy.',
    );
  }

  return trimUrl(publicUrl || 'http://localhost:8080/api');
}
