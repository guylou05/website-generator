import { z } from 'zod';
import { nullableOptional } from './structured-output.js';
export const seoSchema = z
  .object({
    title: z.string().min(1).max(70),
    description: z.string().min(1).max(320),
    canonicalUrl: nullableOptional(z.string().url()),
    noIndex: z.boolean().default(false),
    noFollow: z.boolean().default(false),
    keywords: z.array(z.string().min(1)).default([]),
    openGraph: nullableOptional(
      z
        .object({
          title: nullableOptional(z.string().min(1)),
          description: nullableOptional(z.string().min(1)),
          imageUrl: nullableOptional(z.string().url()),
          imageAlt: nullableOptional(z.string().min(1)),
          type: z.enum(['website', 'article']).default('website'),
        })
        .strict(),
    ),
  })
  .strict();
export type Seo = z.infer<typeof seoSchema>;
