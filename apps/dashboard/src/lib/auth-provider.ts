import type { AuthUser } from './api-client';
import { dashboardApi, type DashboardApiClient } from './api-client';
import { clearAuthCookies } from './cookies';

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  organization_name?: string;
}

/** Stable dashboard contract. A future Passport provider can implement this unchanged. */
export interface AuthProvider {
  currentUser(): Promise<AuthUser>;
  login(input: {
    email: string;
    password: string;
    remember?: boolean;
  }): Promise<AuthUser>;
  logout(): Promise<void>;
  register(input: RegistrationInput): Promise<AuthUser>;
  forgotPassword(email: string): Promise<{ message: string }>;
  resetPassword(input: {
    email: string;
    token: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string }>;
}

export class SanctumAuthProvider implements AuthProvider {
  constructor(private readonly api: DashboardApiClient = dashboardApi) {}
  currentUser() {
    return this.api.currentUser();
  }
  login(input: { email: string; password: string; remember?: boolean }) {
    return this.api.login(input);
  }
  register(input: RegistrationInput) {
    return this.api.register(input);
  }
  forgotPassword(email: string) {
    return this.api.forgotPassword(email);
  }
  resetPassword(input: {
    email: string;
    token: string;
    password: string;
    password_confirmation: string;
  }) {
    return this.api.resetPassword(input);
  }
  async logout() {
    await this.api.logout();
    clearAuthCookies();
  }
}

export function createAuthProvider(
  driver = process.env.NEXT_PUBLIC_AUTH_DRIVER ?? 'sanctum',
): AuthProvider {
  if (driver !== 'sanctum')
    throw new Error(
      `Unsupported authentication driver "${driver}". Install a provider before enabling it.`,
    );
  return new SanctumAuthProvider();
}

export const authProvider = createAuthProvider();
