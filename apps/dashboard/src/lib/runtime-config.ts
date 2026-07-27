export type DeploymentPlatform = 'local' | 'railway' | 'vercel' | 'generic';

function trimUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export function browserApiBase(env: RuntimeEnvironment = process.env): string {
  if (isEnabled(env.NEXT_PUBLIC_USE_PROXY)) return '/api/proxy';
  return trimUrl(env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api');
}

export function internalApiBase(env: RuntimeEnvironment = process.env): string {
  const configured = env.API_INTERNAL_URL;
  if (configured) return trimUrl(configured);

  // Railway private networking is opt-in because service names are project-specific.
  if (env.RAILWAY_ENVIRONMENT_NAME && env.RAILWAY_PRIVATE_DOMAIN)
    return `http://${env.RAILWAY_PRIVATE_DOMAIN}/api`;
  if (env.DOCKER_COMPOSE || env.COMPOSE_PROJECT_NAME) return 'http://nginx/api';
  return trimUrl(env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api');
}

export function deploymentPlatform(
  env: RuntimeEnvironment = process.env,
): DeploymentPlatform {
  if (env.RAILWAY_ENVIRONMENT_NAME) return 'railway';
  if (env.VERCEL) return 'vercel';
  if (
    env.DOCKER_COMPOSE ||
    env.COMPOSE_PROJECT_NAME ||
    env.NODE_ENV === 'development'
  )
    return 'local';
  return 'generic';
}
