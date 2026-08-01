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
type WebsiteContentTransport = {
  pages: z.infer<typeof websiteCopyPageTransportSchema>[];
};
export const websiteContentTransportSchema: z.ZodType<
  WebsiteContentTransport,
  z.ZodTypeDef,
  unknown
> = z.preprocess(
  (input) => normalizeWebsiteContentTransportKeys(input),
  z
    .object({ pages: keyedArray(websiteCopyPageTransportSchema, 'page') })
    .strict(),
);

/**
 * Structured output occasionally repeats a page or section key. Preserve every
 * item by assigning the first available numeric suffix before validation and
 * conversion to domain records.
 */
export function normalizeWebsiteContentTransportKeys(input: unknown): unknown {
  if (
    !input ||
    typeof input !== 'object' ||
    !Array.isArray((input as { pages?: unknown }).pages)
  )
    return input;

  const unique = (values: unknown[]): unknown[] => {
    const used = new Set<string>();
    return values.map((value) => {
      if (!value || typeof value !== 'object') return value;
      const key = (value as { key?: unknown }).key;
      if (typeof key !== 'string' || !used.has(key)) {
        if (typeof key === 'string') used.add(key);
        return value;
      }
      let suffix = 2;
      let candidate = `${key}-${suffix}`;
      while (used.has(candidate)) {
        if (suffix === Number.MAX_SAFE_INTEGER)
          throw new Error(`Could not preserve unique key for ${key}`);
        candidate = `${key}-${++suffix}`;
      }
      used.add(candidate);
      return { ...value, key: candidate };
    });
  };

  const pages = unique((input as { pages: unknown[] }).pages).map((page) => {
    if (
      !page ||
      typeof page !== 'object' ||
      !Array.isArray((page as { sections?: unknown }).sections)
    )
      return page;
    return {
      ...page,
      sections: unique((page as { sections: unknown[] }).sections),
    };
  });
  return { ...input, pages };
}

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

// This is deliberately independent from the canonical schemas. In particular,
// none of these fields use defaults, preprocessors, URL/datetime formats, or
// application refinements: those belong to siteBlueprintSchema after transport.
const nullable = <T extends z.ZodTypeAny>(schema: T) => schema.nullable();
const transportBrandAsset = z
  .object({
    url: z.string(),
    alt: z.string(),
    width: nullable(z.number().int().positive()),
    height: nullable(z.number().int().positive()),
  })
  .strict();
const transportStyle = nullable(
  z
    .object({
      variant: nullable(z.string()),
      align: nullable(z.enum(['start', 'center', 'end'])),
      width: nullable(z.enum(['auto', 'full'])),
    })
    .strict(),
);
const transportComponentBase = {
  id: z.string(),
  accessibilityLabel: nullable(z.string()),
  style: transportStyle,
};
const transportFormField = z
  .object({
    id: z.string(),
    name: z.string(),
    label: z.string(),
    type: z.enum(['text', 'email', 'tel', 'textarea', 'select', 'checkbox']),
    required: z.boolean(),
    placeholder: nullable(z.string()),
    options: nullable(
      z.array(z.object({ label: z.string(), value: z.string() }).strict()),
    ),
  })
  .strict();
const transportComponent = z.discriminatedUnion('type', [
  z
    .object({
      ...transportComponentBase,
      type: z.literal('heading'),
      level: z.number().int().min(1).max(6),
      text: z.string(),
    })
    .strict(),
  z
    .object({
      ...transportComponentBase,
      type: z.literal('text'),
      text: z.string(),
    })
    .strict(),
  z
    .object({
      ...transportComponentBase,
      type: z.literal('button'),
      label: z.string(),
      href: z.string(),
      intent: z.enum(['primary', 'secondary', 'link']),
      external: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...transportComponentBase,
      type: z.literal('image'),
      url: z.string(),
      alt: z.string(),
      caption: nullable(z.string()),
      width: nullable(z.number().int().positive()),
      height: nullable(z.number().int().positive()),
      loading: z.enum(['eager', 'lazy']),
    })
    .strict(),
  z
    .object({
      ...transportComponentBase,
      type: z.literal('form'),
      name: z.string(),
      action: z.string(),
      method: z.enum(['POST', 'GET']),
      fields: z.array(transportFormField),
      submitLabel: z.string(),
      successMessage: z.string(),
      consentText: nullable(z.string()),
    })
    .strict(),
]);
const transportSeo = z
  .object({
    title: z.string(),
    description: z.string(),
    canonicalUrl: nullable(z.string()),
    noIndex: z.boolean(),
    noFollow: z.boolean(),
    keywords: z.array(z.string()),
    openGraph: nullable(
      z
        .object({
          title: nullable(z.string()),
          description: nullable(z.string()),
          imageUrl: nullable(z.string()),
          imageAlt: nullable(z.string()),
          type: z.enum(['website', 'article']),
        })
        .strict(),
    ),
  })
  .strict();
type TransportNavigationItem = {
  id: string;
  label: string;
  href: string;
  external: boolean;
  children: TransportNavigationItem[];
};
const transportNavigationItem: z.ZodType<TransportNavigationItem> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      label: z.string(),
      href: z.string(),
      external: z.boolean(),
      children: z.array(transportNavigationItem),
    })
    .strict(),
);
const transportSection = z
  .object({
    id: z.string(),
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
    label: nullable(z.string()),
    layout: z
      .object({
        container: z.enum(['narrow', 'standard', 'wide', 'full']),
        columns: z.number().int().min(1).max(12),
        spacing: z.enum(['none', 'small', 'medium', 'large']),
        background: z.enum([
          'default',
          'surface',
          'primary',
          'secondary',
          'accent',
        ]),
      })
      .strict(),
    components: z.array(transportComponent),
  })
  .strict();

export const openAIWebsiteBlueprintSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    metadata: z
      .object({
        name: z.string(),
        description: z.string(),
        language: z.string(),
        baseUrl: z.string(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .strict(),
    branding: z
      .object({
        name: z.string(),
        tagline: nullable(z.string()),
        logo: nullable(transportBrandAsset),
        mark: nullable(transportBrandAsset),
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
          .object({
            headingFont: z.string(),
            bodyFont: z.string(),
            baseSize: z.string(),
          })
          .strict(),
      })
      .strict(),
    globalStyles: z
      .object({
        borderRadius: z.enum(['none', 'small', 'medium', 'large', 'pill']),
        contentWidth: z.enum(['narrow', 'standard', 'wide']),
        spacingScale: z.enum(['compact', 'comfortable', 'spacious']),
        buttonStyle: z.enum(['solid', 'outline', 'soft']),
        imageStyle: z.enum(['square', 'rounded', 'soft']),
      })
      .strict(),
    navigation: z
      .object({
        ariaLabel: z.string(),
        items: z.array(transportNavigationItem),
        cta: nullable(
          z
            .object({
              label: z.string(),
              href: z.string(),
              external: z.boolean(),
            })
            .strict(),
        ),
      })
      .strict(),
    defaultSeo: transportSeo,
    pages: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          slug: z.string(),
          description: nullable(z.string()),
          showInNavigation: z.boolean(),
          seo: transportSeo,
          sections: z.array(transportSection),
        })
        .strict(),
    ),
    footer: z
      .object({
        tagline: nullable(z.string()),
        columns: z.array(
          z
            .object({
              title: z.string(),
              links: z.array(transportNavigationItem),
            })
            .strict(),
        ),
        socialLinks: z.array(
          z
            .object({
              platform: z.string(),
              href: z.string(),
              label: z.string(),
            })
            .strict(),
        ),
        components: z.array(transportComponent),
        copyright: z.string(),
      })
      .strict(),
  })
  .strict();

export { siteBlueprintSchema };
export const openAISchemas = {
  business_analysis: businessAnalysisSchema,
  website_plan: websitePlanSchema,
  website_copy: websiteContentTransportSchema,
  seo: seoContentTransportSchema,
  design: designPlanTransportSchema,
  blueprint: openAIWebsiteBlueprintSchema,
  blueprint_repair: openAIWebsiteBlueprintSchema,
} as const;
