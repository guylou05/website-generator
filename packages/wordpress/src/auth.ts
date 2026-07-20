import type { WordPressCredentials } from './types.js';
import { WordPressConfigurationError } from './errors.js';
export function normalizeWordPressUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new WordPressConfigurationError(
      'WordPress URL must be a valid HTTP or HTTPS URL',
    );
  }
}
export function applicationPasswordAuthorization(
  credentials: WordPressCredentials,
): string {
  if (!credentials.username.trim() || !credentials.applicationPassword.trim())
    throw new WordPressConfigurationError(
      'WordPress username and application password are required',
    );
  return `Basic ${encodeBase64(`${credentials.username}:${credentials.applicationPassword.replace(/\s+/g, '')}`)}`;
}
function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
