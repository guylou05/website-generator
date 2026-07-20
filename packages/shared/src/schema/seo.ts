import { z } from 'zod';
export const seoSchema = z
  .object({
    title: z.string().min(1).max(70),
    description: z.string().min(1).max(320),
    canonicalUrl: z.string().url().optional(),
    noIndex: z.boolean().default(false),
    noFollow: z.boolean().default(false),
    keywords: z.array(z.string().min(1)).default([]),
    openGraph: z
      .object({
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        imageUrl: z.string().url().optional(),
        imageAlt: z.string().min(1).optional(),
        type: z.enum(['website', 'article']).default('website'),
      })
      .strict()
      .optional(),
  })
  .strict();
export type Seo = z.infer<typeof seoSchema>;
