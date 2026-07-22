import { createHash } from 'node:crypto';

export type MediaReference = {
  assetId: string;
  variant?: string;
  altText?: string;
  focalPoint?: { x: number; y: number };
  decorative?: boolean;
};
export type Transformation = {
  crop?: { x: number; y: number; width: number; height: number };
  resize?: { width: number; height?: number };
  rotate?: 0 | 90 | 180 | 270;
  flip?: 'horizontal' | 'vertical';
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
  focalPoint?: { x: number; y: number };
};
const stable = (value: unknown): string =>
  value && typeof value === 'object'
    ? Array.isArray(value)
      ? `[${value.map(stable).join(',')}]`
      : `{${Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
          .join(',')}}`
    : JSON.stringify(value);
export const transformationHash = (assetId: string, input: Transformation) =>
  createHash('sha256')
    .update(`${assetId}:${stable(input)}`)
    .digest('hex');
export const normalizeMediaReference = (
  value: unknown,
): MediaReference | string | null => {
  if (typeof value === 'string') return value; // legacy URLs remain renderable but are never created by the editor
  if (!value || typeof value !== 'object') return null;
  const x = value as Record<string, unknown>;
  if (typeof x.assetId !== 'string') return null;
  const ref: MediaReference = { assetId: x.assetId };
  if (typeof x.variant === 'string') ref.variant = x.variant;
  if (typeof x.altText === 'string') ref.altText = x.altText;
  ref.decorative = x.decorative === true;
  if (x.focalPoint && typeof x.focalPoint === 'object') {
    const f = x.focalPoint as Record<string, unknown>;
    if (
      typeof f.x === 'number' &&
      typeof f.y === 'number' &&
      f.x >= 0 &&
      f.x <= 1 &&
      f.y >= 0 &&
      f.y <= 1
    )
      ref.focalPoint = { x: f.x, y: f.y };
  }
  return ref;
};
export const selectResponsiveVariant = (
  variants: Array<{ width: number; url: string }>,
  targetWidth: number,
) =>
  [...variants]
    .sort((a, b) => a.width - b.width)
    .find((v) => v.width >= targetWidth) ??
  [...variants].sort((a, b) => b.width - a.width)[0];
export interface ImageProvider {
  textToImage(input: {
    prompt: string;
    aspectRatio: string;
    count: number;
  }): Promise<Array<{ url: string; metadata?: Record<string, unknown> }>>;
  imageToImage?(input: unknown): Promise<unknown>;
  editImage?(input: unknown): Promise<unknown>;
  generateVariations?(input: unknown): Promise<unknown>;
  removeBackground?(input: unknown): Promise<unknown>;
  providerHealth(): Promise<{ ok: boolean }>;
}
export interface StockProvider {
  search(input: {
    query: string;
    page?: number;
    orientation?: string;
    color?: string;
  }): Promise<{ items: unknown[]; nextPage?: number }>;
  import(
    id: string,
  ): Promise<{ downloadUrl: string; attribution: Record<string, unknown> }>;
  providerHealth(): Promise<{ ok: boolean }>;
}
export const assertControlledDownloadUrl = (
  raw: string,
  allowedHosts: string[],
) => {
  const url = new URL(raw);
  if (
    url.protocol !== 'https:' ||
    !allowedHosts.includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error('Remote media URL is not allowed.');
  return url;
};
export const redactMediaSecrets = (value: string) =>
  value
    .replace(
      /([?&](?:X-Amz-Signature|token|signature)=)[^&\s]+/gi,
      '$1[REDACTED]',
    )
    .replace(/(MEDIA_S3_SECRET_ACCESS_KEY=)[^\s]+/gi, '$1[REDACTED]');
