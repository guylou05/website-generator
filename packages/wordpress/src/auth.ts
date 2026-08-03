import type { WordPressAuthentication } from './types.js';
import {
  WordPressAuthenticationConfigurationError,
  WordPressConfigurationError,
} from './errors.js';
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
  username: unknown,
  applicationPassword: unknown,
): string {
  if (typeof username !== 'string' || !username.trim())
    throw new WordPressAuthenticationConfigurationError(
      'application_password_username_missing',
    );
  if (typeof applicationPassword !== 'string' || !applicationPassword.trim())
    throw new WordPressAuthenticationConfigurationError(
      'application_password_missing',
    );
  return `Basic ${encodeBase64(`${username}:${applicationPassword.replace(/\s+/g, '')}`)}`;
}
export function authenticationAuthorization(
  authentication: WordPressAuthentication,
): string {
  if (!authentication || typeof authentication !== 'object')
    throw new WordPressAuthenticationConfigurationError(
      'unsupported_authentication_type',
    );
  if (authentication.type === 'connector') {
    if (
      typeof authentication.token !== 'string' ||
      !authentication.token.trim()
    )
      throw new WordPressAuthenticationConfigurationError(
        'connector_token_missing',
      );
    return `Bearer ${authentication.token}`;
  }
  if (authentication.type === 'application_password')
    return applicationPasswordAuthorization(
      authentication.username,
      authentication.applicationPassword,
    );
  throw new WordPressAuthenticationConfigurationError(
    'unsupported_authentication_type',
  );
}
function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
