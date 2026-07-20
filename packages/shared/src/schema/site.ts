import { z } from 'zod';
import { brandingSchema } from './branding.js';
import { componentSchema } from './component.js';
import { navigationItemSchema, navigationSchema } from './navigation.js';
import { pageSchema } from './page.js';
import { seoSchema } from './seo.js';

export const siteMetadataSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    language: z
      .string()
      .regex(
        /^[a-z]{2}(?:-[A-Z]{2})?$/,
        'Use a BCP 47 language tag such as en or en-US',
      ),
    baseUrl: z.string().url(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

/** Semantic design tokens, deliberately free of framework or builder properties. */
export const globalStylesSchema = z
  .object({
    borderRadius: z.enum(['none', 'small', 'medium', 'large', 'pill']),
    contentWidth: z.enum(['narrow', 'standard', 'wide']),
    spacingScale: z.enum(['compact', 'comfortable', 'spacious']),
    buttonStyle: z.enum(['solid', 'outline', 'soft']),
    imageStyle: z.enum(['square', 'rounded', 'soft']),
  })
  .strict();

export const footerSchema = z
  .object({
    tagline: z.string().min(1).optional(),
    columns: z
      .array(
        z
          .object({
            title: z.string().min(1),
            links: z.array(navigationItemSchema).min(1),
          })
          .strict(),
      )
      .default([]),
    socialLinks: z
      .array(
        z
          .object({
            platform: z.string().min(1),
            href: z.string().url(),
            label: z.string().min(1),
          })
          .strict(),
      )
      .default([]),
    components: z.array(componentSchema).default([]),
    copyright: z.string().min(1),
  })
  .strict();

export const siteBlueprintSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    metadata: siteMetadataSchema,
    branding: brandingSchema,
    globalStyles: globalStylesSchema,
    navigation: navigationSchema,
    defaultSeo: seoSchema,
    pages: z.array(pageSchema).min(1),
    footer: footerSchema,
  })
  .strict()
  .superRefine((site, context) => {
    for (const key of ['id', 'slug'] as const) {
      const seen = new Set<string>();
      site.pages.forEach((page, index) => {
        if (seen.has(page[key]))
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Page ${key} must be unique`,
            path: ['pages', index, key],
          });
        seen.add(page[key]);
      });
    }
  });

export type SiteMetadata = z.infer<typeof siteMetadataSchema>;
export type GlobalStyles = z.infer<typeof globalStylesSchema>;
export type Footer = z.infer<typeof footerSchema>;
export type SiteBlueprint = z.infer<typeof siteBlueprintSchema>;
