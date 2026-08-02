export interface CookieOptions {
  domain?: string;
  expires?: Date;
  maxAge?: number;
  path?: string;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
}

export function readCookie(name: string, source?: string): string | null {
  const input =
    source ?? (typeof document === 'undefined' ? '' : document.cookie);
  const item = input
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));
  if (!item) return null;
  try {
    return decodeURIComponent(item.slice(name.length + 1));
  } catch {
    return item.slice(name.length + 1);
  }
}

export const readXsrfToken = (source?: string) =>
  readCookie('XSRF-TOKEN', source);

export function writeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): void {
  if (typeof document === 'undefined') return;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? '/'}`,
  ];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push('Secure');
  document.cookie = parts.join('; ');
}

export function clearAuthCookies(domain?: string): void {
  for (const name of ['XSRF-TOKEN', 'website_generator_session']) {
    writeCookie(name, '', {
      ...(domain ? { domain } : {}),
      expires: new Date(0),
      maxAge: 0,
    });
    if (domain) writeCookie(name, '', { expires: new Date(0), maxAge: 0 });
  }
}

/** Re-scope API cookies to the dashboard host when requests use the same-origin proxy. */
export function rewriteSetCookieForProxy(value: string): string {
  const attributes = value.split(';').map((part) => part.trim());
  // The upstream API domain cannot be sent to a same-origin dashboard client.
  // All other attributes are authoritative and must survive unchanged.
  return attributes.filter((part) => !/^domain=/i.test(part)).join('; ');
}
