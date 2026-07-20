import { z } from 'zod';
export const brandAssetSchema = z
  .object({
    url: z.string().url(),
    alt: z.string().min(1),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();
/** Semantic brand tokens; each renderer controls their implementation. */
export const brandingSchema = z
  .object({
    name: z.string().min(1),
    tagline: z.string().min(1).optional(),
    logo: brandAssetSchema.optional(),
    mark: brandAssetSchema.optional(),
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
