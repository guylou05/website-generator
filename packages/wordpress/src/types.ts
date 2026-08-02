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
export type WordPressPageStatus = 'draft' | 'pending' | 'private' | 'publish';
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

export interface WordPressSnapshot {
  readonly capturedAt: string;
  readonly pages: readonly SnapshotPage[];
  readonly media: readonly SnapshotMedia[];
  readonly menus: readonly SnapshotMenu[];
  readonly homepage: { readonly showOnFront: string; readonly pageId: number };
  readonly settings: Readonly<Record<string, unknown>>;
  readonly elementor: {
    readonly active: boolean;
    readonly version?: string;
    readonly cssCachePresent: boolean;
  };
}
export interface SnapshotPage {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly status: string;
  readonly modified?: string;
  readonly contentHash?: string;
  readonly elementorHash?: string;
  readonly elementorDocument?: unknown;
  readonly seo?: Readonly<Record<string, unknown>>;
}
export interface SnapshotMedia {
  readonly id: number;
  readonly filename: string;
  readonly url: string;
  readonly alt?: string;
  readonly hash?: string;
}
export interface SnapshotMenu {
  readonly id: number;
  readonly name: string;
  readonly location?: string;
  readonly items: readonly {
    readonly title: string;
    readonly url: string;
    readonly parent?: number;
  }[];
}
export type PlanAction =
  'create' | 'update' | 'delete' | 'unchanged' | 'regenerate' | 'configure';
export type PlanResource =
  | 'page'
  | 'elementor'
  | 'media'
  | 'menu'
  | 'homepage'
  | 'seo'
  | 'css'
  | 'settings';
export interface PlanChange {
  readonly resource: PlanResource;
  readonly action: PlanAction;
  readonly identifier: string;
  readonly label: string;
  readonly safe: boolean;
  readonly reason: string;
  readonly before?: unknown;
  readonly after?: unknown;
}
export interface DeploymentPlan {
  readonly schemaVersion: '1.0';
  readonly createdAt: string;
  readonly snapshotCapturedAt: string;
  readonly changes: readonly PlanChange[];
  readonly statistics: Readonly<Record<PlanAction, number>> & {
    readonly total: number;
  };
  readonly estimatedSeconds: number;
  readonly warnings: readonly string[];
  readonly safetyStatus: 'safe' | 'warning' | 'blocked';
  readonly readOnly: true;
}
