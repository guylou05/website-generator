export class WordPressError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'WordPressError';
  }
}
export class WordPressAuthenticationError extends WordPressError {
  constructor(
    message = 'WordPress authentication failed',
    status = 401,
    options?: ErrorOptions,
  ) {
    super(message, 'authentication_failed', status, options);
    this.name = 'WordPressAuthenticationError';
  }
}
export class WordPressTimeoutError extends WordPressError {
  constructor(
    readonly timeoutMs: number,
    options?: ErrorOptions,
  ) {
    super(
      `WordPress request timed out after ${timeoutMs}ms`,
      'request_timeout',
      undefined,
      options,
    );
    this.name = 'WordPressTimeoutError';
  }
}
export class WordPressApiError extends WordPressError {
  constructor(
    message: string,
    readonly method: string,
    readonly path: string,
    status?: number,
    readonly responseCode?: string,
    options?: ErrorOptions,
  ) {
    super(
      `${method} ${path}: ${message}`,
      responseCode ?? 'api_error',
      status,
      options,
    );
    this.name = 'WordPressApiError';
  }
}
export class WordPressConfigurationError extends WordPressError {
  constructor(message: string) {
    super(message, 'invalid_configuration');
    this.name = 'WordPressConfigurationError';
  }
}
export class WordPressAuthenticationConfigurationError extends WordPressError {
  constructor(
    readonly code:
      | 'connector_token_missing'
      | 'application_password_username_missing'
      | 'application_password_missing'
      | 'unsupported_authentication_type',
  ) {
    const messages = {
      connector_token_missing: 'A connector token is required',
      application_password_username_missing: 'A WordPress username is required',
      application_password_missing:
        'A WordPress application password is required',
      unsupported_authentication_type:
        'The WordPress authentication type is unsupported',
    } as const;
    super(messages[code], code);
    this.name = 'WordPressAuthenticationConfigurationError';
  }
}
export class WordPressDeploymentError extends WordPressError {
  constructor(
    message: string,
    readonly resource: string,
    options?: ErrorOptions,
  ) {
    super(message, 'deployment_failed', undefined, options);
    this.name = 'WordPressDeploymentError';
  }
}
