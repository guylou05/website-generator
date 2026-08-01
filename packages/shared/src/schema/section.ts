import { z } from 'zod';
import { componentSchema } from './component.js';
import { nullableOptional } from './structured-output.js';
/** A semantic region whose layout hints are portable across builders. */
export const SECTION_TYPES = [
  'hero',
  'content',
  'features',
  'services',
  'testimonials',
  'cta',
  'contact',
  'custom',
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const sectionSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(SECTION_TYPES),
    label: nullableOptional(z.string().min(1)),
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
