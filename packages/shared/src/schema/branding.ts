import { z } from 'zod';
import { nullableOptional } from './structured-output.js';
export const brandAssetSchema = z
  .object({
    url: z.string().url(),
    alt: z.string().min(1),
    width: nullableOptional(z.number().int().positive()),
    height: nullableOptional(z.number().int().positive()),
  })
  .strict();
/** Semantic brand tokens; each renderer controls their implementation. */
export const brandingSchema = z
  .object({
    name: z.string().min(1),
    tagline: nullableOptional(z.string().min(1)),
    logo: nullableOptional(brandAssetSchema),
    mark: nullableOptional(brandAssetSchema),
    colors: z
      .object({
        primary: z.string().min(1),
        secondary: z.string().min(1),
        accent: z.string().min(1),
        background: z.string().min(1),
        surface: z.string().min(1),
        text: z.string().min(1),
        mutedText: z.string().min(1),
      })
      .strict(),
    typography: z
      .object({
        headingFont: z.string().min(1),
        bodyFont: z.string().min(1),
        baseSize: z.string().min(1).default('1rem'),
      })
      .strict(),
  })
  .strict();
export type BrandAsset = z.infer<typeof brandAssetSchema>;
export type Branding = z.infer<typeof brandingSchema>;
