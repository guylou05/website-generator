import type { SiteBlueprint } from '@website-generator/shared/schema';
import type { ElementorDocument } from '@website-generator/renderer/elementor';

export interface WordPressCredentials {
  readonly url: string;
  readonly username: string;
  readonly applicationPassword: string;
}
export interface WordPressClientOptions {
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly fetch?: typeof fetch;
  readonly logger?: WordPressLogger;
}
export interface WordPressLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}
export type WordPressPageStatus = 'draft' | 'pending' | 'private';
export interface WordPressPage {
  readonly id: number;
  readonly slug: string;
  readonly status: string;
  readonly link: string;
  readonly title: { readonly rendered: string };
  readonly featured_media: number;
}
export interface WordPressMedia {
  readonly id: number;
  readonly source_url: string;
  readonly slug: string;
}
export interface PageWriteInput {
  readonly title: string;
  readonly slug: string;
  readonly status?: WordPressPageStatus;
  readonly content?: string;
  readonly featuredMediaId?: number;
}
export interface MediaUploadInput {
  readonly bytes: Blob | Uint8Array;
  readonly filename: string;
  readonly mimeType: string;
  readonly title?: string;
  readonly altText?: string;
}
export interface ConnectorMenuItem {
  readonly key: string;
  readonly title: string;
  readonly url: string;
  readonly pageId?: number;
  readonly parentKey?: string;
}
export interface DeploymentInput {
  readonly blueprint: SiteBlueprint;
  readonly elementorPages: Readonly<Record<string, ElementorDocument>>;
  readonly status?: WordPressPageStatus;
  readonly dryRun?: boolean;
  readonly menuName?: string;
  readonly setHomepage?: boolean;
}
export type DeploymentOperation = {
  readonly action: 'create' | 'update' | 'configure';
  readonly resource: 'page' | 'elementor' | 'menu' | 'homepage';
  readonly identifier: string;
  readonly details?: Readonly<Record<string, unknown>>;
};
export interface DeploymentPageResult {
  readonly blueprintPageId: string;
  readonly wordpressPageId?: number;
  readonly slug: string;
  readonly action: 'create' | 'update';
}
export interface DeploymentResult {
  readonly dryRun: boolean;
  readonly pages: readonly DeploymentPageResult[];
  readonly operations: readonly DeploymentOperation[];
}
export interface ConnectionTestResult {
  readonly success: true;
  readonly userId: number;
  readonly username: string;
  readonly capabilities: Readonly<Record<string, boolean>>;
}
