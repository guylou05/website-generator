import { z } from 'zod';
const base = {
  id: z.string().min(1),
  accessibilityLabel: z.string().min(1).optional(),
  style: z
    .object({
      variant: z.string().min(1).optional(),
      align: z.enum(['start', 'center', 'end']).optional(),
      width: z.enum(['auto', 'full']).optional(),
    })
    .strict()
    .optional(),
};
export const headingComponentSchema = z
  .object({
    ...base,
    type: z.literal('heading'),
    level: z.number().int().min(1).max(6),
    text: z.string().min(1),
  })
  .strict();
export const textComponentSchema = z
  .object({ ...base, type: z.literal('text'), text: z.string().min(1) })
  .strict();
export const buttonComponentSchema = z
  .object({
    ...base,
    type: z.literal('button'),
    label: z.string().min(1),
    href: z.string().min(1),
    intent: z.enum(['primary', 'secondary', 'link']).default('primary'),
    external: z.boolean().default(false),
  })
  .strict();
export const imageComponentSchema = z
  .object({
    ...base,
    type: z.literal('image'),
    url: z.string().url(),
    alt: z.string(),
    caption: z.string().min(1).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    loading: z.enum(['eager', 'lazy']).default('lazy'),
  })
  .strict();
export const formFieldSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(['text', 'email', 'tel', 'textarea', 'select', 'checkbox']),
    required: z.boolean().default(false),
    placeholder: z.string().optional(),
    options: z
      .array(
        z
          .object({ label: z.string().min(1), value: z.string().min(1) })
          .strict(),
      )
      .optional(),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.type === 'select' && !field.options?.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select fields require at least one option',
        path: ['options'],
      });
  });
export const formComponentSchema = z
  .object({
    ...base,
    type: z.literal('form'),
    name: z.string().min(1),
    action: z.string().min(1),
    method: z.enum(['POST', 'GET']).default('POST'),
    fields: z.array(formFieldSchema).min(1),
    submitLabel: z.string().min(1),
    successMessage: z.string().min(1),
    consentText: z.string().min(1).optional(),
  })
  .strict();
/** Builder-neutral content primitives supported by every renderer. */
export const componentSchema = z.discriminatedUnion('type', [
  headingComponentSchema,
  textComponentSchema,
  buttonComponentSchema,
  imageComponentSchema,
  formComponentSchema,
]);
export type BlueprintComponent = z.infer<typeof componentSchema>;
export type FormField = z.infer<typeof formFieldSchema>;
