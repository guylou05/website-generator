import { z } from 'zod';
import { componentSchema } from './component.js';
/** A semantic region whose layout hints are portable across builders. */
export const sectionSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum([
      'hero',
      'content',
      'features',
      'services',
      'testimonials',
      'cta',
      'contact',
      'custom',
    ]),
    label: z.string().min(1).optional(),
    layout: z
      .object({
        container: z
          .enum(['narrow', 'standard', 'wide', 'full'])
          .default('standard'),
        columns: z.number().int().min(1).max(12).default(1),
        spacing: z.enum(['none', 'small', 'medium', 'large']).default('medium'),
        background: z
          .enum(['default', 'surface', 'primary', 'secondary', 'accent'])
          .default('default'),
      })
      .strict()
      .default({}),
    components: z.array(componentSchema).min(1),
  })
  .strict();
export type Section = z.infer<typeof sectionSchema>;
