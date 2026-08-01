import { z } from 'zod';
import { siteBlueprintSchema } from '@website-generator/shared/schema';
import type { DesignPlan } from '../../designer/index.js';
import type { SeoContent, WebsiteContent } from '../../writer/index.js';

const keyedArray = <T extends z.ZodTypeAny>(item: T, label: string) =>
  z.array(item).superRefine((items, context) => {
    const seen = new Set<string>();
    items.forEach((value, index) => {
      const key = (value as { key: string }).key;
      if (seen.has(key))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate ${label} key: ${key}`,
          path: [index, 'key'],
        });
      seen.add(key);
    });
  });

const offering = z
  .object({
    name: z.string(),
    description: z.string(),
    audience: z.string().nullable(),
  })
  .strict();
export const businessAnalysisSchema = z
  .object({
    summary: z.string(),
    industry: z.string(),
    audiences: z.array(
      z
        .object({
          name: z.string(),
          needs: z.array(z.string()),
          objections: z.array(z.string()),
        })
        .strict(),
    ),
    offerings: z.array(offering),
    valueProposition: z.string(),
    goals: z.array(z.string()),
    recommendedTone: z.array(z.string()),
    constraints: z.array(z.string()),
  })
  .strict();
type Navigation = {
  label: string;
  pageKey: string;
  children: Navigation[] | null;
};
const navigation: z.ZodType<Navigation> = z.lazy(() =>
  z
    .object({
      label: z.string(),
      pageKey: z.string(),
      children: z.array(navigation).nullable(),
    })
    .strict(),
) as z.ZodType<Navigation>;
export const websitePlanSchema = z
  .object({
    strategy: z.string(),
    primaryGoal: z.string(),
    navigation: z.array(navigation),
    pages: keyedArray(
      z
        .object({
          key: z.string().min(1),
          title: z.string(),
          purpose: z.string(),
          audience: z.string(),
          sections: keyedArray(
            z
              .object({
                key: z.string().min(1),
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
              })
              .strict(),
            'section',
          ),
        })
        .strict(),
      'page',
    ),
  })
  .strict();

const contentItem = z.object({ title: z.string(), body: z.string() }).strict();
const callToAction = z
  .object({ label: z.string(), destination: z.string() })
  .strict();
const websiteCopySectionDomainSchema = z
  .object({
    heading: z.string().optional(),
    body: z.string().optional(),
    items: z.array(contentItem).optional(),
    callToAction: callToAction.optional(),
  })
  .strict();
export const websiteContentSchema = z
  .object({
    pages: z.record(
      z.string(),
      z
        .object({
          sections: z.record(z.string(), websiteCopySectionDomainSchema),
        })
        .strict(),
    ),
  })
  .strict();

export const websiteCopySectionTransportSchema = z
  .object({
    key: z.string().min(1),
    heading: z.string().nullable(),
    body: z.string().nullable(),
    items: z.array(contentItem).nullable(),
    callToAction: callToAction.nullable(),
  })
  .strict();
export const websiteCopyPageTransportSchema = z
  .object({
    key: z.string().min(1),
    sections: keyedArray(websiteCopySectionTransportSchema, 'section'),
  })
  .strict();
export const websiteContentTransportSchema = z
  .object({ pages: keyedArray(websiteCopyPageTransportSchema, 'page') })
  .strict();

const seoPageTransportSchema = z
  .object({
    key: z.string().min(1),
    title: z.string(),
    description: z.string(),
    keywords: z.array(z.string()),
  })
  .strict();
export const seoContentTransportSchema = z
  .object({
    siteTitle: z.string(),
    pages: keyedArray(seoPageTransportSchema, 'page'),
  })
  .strict();
export const seoContentSchema = z.object({
  siteTitle: z.string(),
  pages: z.record(z.string(), seoPageTransportSchema.omit({ key: true })),
});

const sectionLayoutTransportSchema = z
  .object({
    key: z.string().min(1),
    container: z.enum(['narrow', 'standard', 'wide', 'full']),
    columns: z.number().int().min(1).max(4),
    background: z.enum([
      'default',
      'surface',
      'primary',
      'secondary',
      'accent',
    ]),
  })
  .strict();
const pageLayoutTransportSchema = z
  .object({
    key: z.string().min(1),
    sections: keyedArray(sectionLayoutTransportSchema, 'section'),
  })
  .strict();
export const designPlanTransportSchema = z
  .object({
    direction: z.string(),
    colors: z
      .object({
        primary: z.string(),
        secondary: z.string(),
        accent: z.string(),
        background: z.string(),
        surface: z.string(),
        text: z.string(),
        mutedText: z.string(),
      })
      .strict(),
    typography: z
      .object({ headingFont: z.string(), bodyFont: z.string() })
      .strict(),
    globalStyles: z
      .object({
        borderRadius: z.enum(['none', 'small', 'medium', 'large', 'pill']),
        contentWidth: z.enum(['narrow', 'standard', 'wide']),
        spacingScale: z.enum(['compact', 'comfortable', 'spacious']),
      })
      .strict(),
    pageLayouts: keyedArray(pageLayoutTransportSchema, 'page'),
  })
  .strict();

type Keyed = { key: string };
export function transportArrayToRecord<T extends Keyed, R>(
  values: readonly T[],
  convert: (value: T) => R,
  label: string,
): Record<string, R> {
  const result: Record<string, R> = {};
  for (const value of values) {
    if (Object.hasOwn(result, value.key))
      throw new Error(`Duplicate ${label} key: ${value.key}`);
    result[value.key] = convert(value);
  }
  return result;
}
export function domainRecordToTransport<T, R>(
  values: Readonly<Record<string, T>>,
  convert: (key: string, value: T) => R,
): R[] {
  return Object.entries(values).map(([key, value]) => convert(key, value));
}

export function websiteContentFromTransport(
  value: z.infer<typeof websiteContentTransportSchema>,
): WebsiteContent {
  return {
    pages: transportArrayToRecord(
      value.pages,
      (page) => ({
        sections: transportArrayToRecord(
          page.sections,
          (section) => ({
            ...(section.heading === null ? {} : { heading: section.heading }),
            ...(section.body === null ? {} : { body: section.body }),
            ...(section.items === null ? {} : { items: section.items }),
            ...(section.callToAction === null
              ? {}
              : { callToAction: section.callToAction }),
          }),
          'section',
        ),
      }),
      'page',
    ),
  };
}
export function websiteContentToTransport(value: WebsiteContent) {
  return {
    pages: domainRecordToTransport(value.pages, (key, page) => ({
      key,
      sections: domainRecordToTransport(
        page.sections,
        (sectionKey, section) => ({
          key: sectionKey,
          heading: section.heading ?? null,
          body: section.body ?? null,
          items: section.items ? [...section.items] : null,
          callToAction: section.callToAction ?? null,
        }),
      ),
    })),
  };
}
export function seoContentFromTransport(
  value: z.infer<typeof seoContentTransportSchema>,
): SeoContent {
  return {
    siteTitle: value.siteTitle,
    pages: transportArrayToRecord(
      value.pages,
      (page) => ({
        title: page.title,
        description: page.description,
        keywords: page.keywords,
      }),
      'page',
    ),
  };
}
export function designPlanFromTransport(
  value: z.infer<typeof designPlanTransportSchema>,
): DesignPlan {
  return {
    ...value,
    pageLayouts: transportArrayToRecord(
      value.pageLayouts,
      (page) => ({
        sections: transportArrayToRecord(
          page.sections,
          (section) => ({
            container: section.container,
            columns: section.columns,
            background: section.background,
          }),
          'section',
        ),
      }),
      'page',
    ),
  };
}

export { siteBlueprintSchema };
export const openAISchemas = {
  business_analysis: businessAnalysisSchema,
  website_plan: websitePlanSchema,
  website_copy: websiteContentTransportSchema,
  seo: seoContentTransportSchema,
  design: designPlanTransportSchema,
  blueprint: siteBlueprintSchema,
  blueprint_repair: siteBlueprintSchema,
} as const;
