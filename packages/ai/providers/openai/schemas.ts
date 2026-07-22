import { z } from 'zod';
import { siteBlueprintSchema } from '@website-generator/shared/schema';

const offering = z.object({
  name: z.string(),
  description: z.string(),
  audience: z.string().optional(),
});
export const businessAnalysisSchema = z.object({
  summary: z.string(),
  industry: z.string(),
  audiences: z.array(
    z.object({
      name: z.string(),
      needs: z.array(z.string()),
      objections: z.array(z.string()),
    }),
  ),
  offerings: z.array(offering),
  valueProposition: z.string(),
  goals: z.array(z.string()),
  recommendedTone: z.array(z.string()),
  constraints: z.array(z.string()),
});
type Navigation = { label: string; pageKey: string; children?: Navigation[] };
const navigation: z.ZodType<Navigation> = z.lazy(() =>
  z.object({
    label: z.string(),
    pageKey: z.string(),
    children: z.array(navigation).optional(),
  }),
) as z.ZodType<Navigation>;
export const websitePlanSchema = z.object({
  strategy: z.string(),
  primaryGoal: z.string(),
  navigation: z.array(navigation),
  pages: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      purpose: z.string(),
      audience: z.string(),
      sections: z.array(
        z.object({
          key: z.string(),
          purpose: z.string(),
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
          contentRequirements: z.array(z.string()),
        }),
      ),
    }),
  ),
});
const contentItem = z.object({ title: z.string(), body: z.string() });
export const websiteContentSchema = z.object({
  pages: z.record(
    z.object({
      sections: z.record(
        z.object({
          heading: z.string().optional(),
          body: z.string().optional(),
          items: z.array(contentItem).optional(),
          callToAction: z
            .object({ label: z.string(), destination: z.string() })
            .optional(),
        }),
      ),
    }),
  ),
});
export const seoContentSchema = z.object({
  siteTitle: z.string(),
  pages: z.record(
    z.object({
      title: z.string(),
      description: z.string(),
      keywords: z.array(z.string()),
    }),
  ),
});
export const designPlanSchema = z.object({
  direction: z.string(),
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    mutedText: z.string(),
  }),
  typography: z.object({ headingFont: z.string(), bodyFont: z.string() }),
  globalStyles: z.object({
    borderRadius: z.enum(['none', 'small', 'medium', 'large', 'pill']),
    contentWidth: z.enum(['narrow', 'standard', 'wide']),
    spacingScale: z.enum(['compact', 'comfortable', 'spacious']),
  }),
  pageLayouts: z.record(
    z.object({
      sections: z.record(
        z.object({
          container: z.enum(['narrow', 'standard', 'wide', 'full']),
          columns: z.number().int().min(1).max(4),
          background: z.enum([
            'default',
            'surface',
            'primary',
            'secondary',
            'accent',
          ]),
        }),
      ),
    }),
  ),
});
export { siteBlueprintSchema };
