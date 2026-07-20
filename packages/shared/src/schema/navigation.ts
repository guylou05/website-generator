import { z } from 'zod';
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  external?: boolean;
  children?: NavigationItem[];
}
export const navigationItemSchema: z.ZodType<NavigationItem> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      label: z.string().min(1),
      href: z.string().min(1),
      external: z.boolean().default(false),
      children: z.array(navigationItemSchema).default([]),
    })
    .strict(),
);
export const navigationSchema = z
  .object({
    ariaLabel: z.string().min(1).default('Primary navigation'),
    items: z.array(navigationItemSchema),
    cta: z
      .object({
        label: z.string().min(1),
        href: z.string().min(1),
        external: z.boolean().default(false),
      })
      .strict()
      .optional(),
  })
  .strict();
export type Navigation = z.infer<typeof navigationSchema>;
