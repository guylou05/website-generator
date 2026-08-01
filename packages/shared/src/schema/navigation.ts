import { z } from 'zod';
import { nullableOptional } from './structured-output.js';
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  external?: boolean;
  children?: NavigationItem[];
}
export const navigationItemSchema: z.ZodType<
  NavigationItem,
  z.ZodTypeDef,
  unknown
> = z.lazy(() =>
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
    cta: nullableOptional(
      z
        .object({
          label: z.string().min(1),
          href: z.string().min(1),
          external: z.boolean().default(false),
        })
        .strict(),
    ),
  })
  .strict();
export type Navigation = z.infer<typeof navigationSchema>;
