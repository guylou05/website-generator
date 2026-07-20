import { z } from 'zod';
import { sectionSchema } from './section.js';
import { seoSchema } from './seo.js';
export const pageSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    slug: z
      .string()
      .regex(
        /^\/?(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)?$/,
        'Use a URL-safe relative slug',
      ),
    description: z.string().min(1).optional(),
    showInNavigation: z.boolean().default(true),
    seo: seoSchema,
    sections: z.array(sectionSchema).min(1),
  })
  .strict();
export type Page = z.infer<typeof pageSchema>;
