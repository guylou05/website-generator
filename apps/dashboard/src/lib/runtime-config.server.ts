import 'server-only';

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

function trimUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function internalApiBase(env: RuntimeEnvironment = process.env): string {
  const configured = env.API_INTERNAL_URL;
  if (configured) {
    const base = trimUrl(configured);
    return base.endsWith('/api') ? base : `${base}/api`;
  }

  // Railway private networking is opt-in because service names are project-specific.
  if (env.RAILWAY_ENVIRONMENT_NAME && env.RAILWAY_PRIVATE_DOMAIN)
    return `http://${env.RAILWAY_PRIVATE_DOMAIN}/api`;
  if (env.DOCKER_COMPOSE || env.COMPOSE_PROJECT_NAME) return 'http://nginx/api';
  if (
    env.NODE_ENV === 'production' &&
    ['1', 'true', 'yes', 'on'].includes(
      env.NEXT_PUBLIC_USE_PROXY?.trim().toLowerCase() ?? '',
    )
  ) {
    throw new Error(
      'Invalid dashboard configuration: API_INTERNAL_URL is required for production proxy mode.',
    );
  }
  return trimUrl(env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api');
}
