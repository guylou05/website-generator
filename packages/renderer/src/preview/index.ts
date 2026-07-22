export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';
export const previewWidths: Record<PreviewDevice, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 390,
};
export const supportedPreviewSections = new Set([
  'header',
  'footer',
  'hero',
  'text',
  'custom',
  'image-text',
  'services',
  'features',
  'cta',
  'testimonials',
  'faq',
  'contact',
  'business-hours',
  'logo-strip',
  'statistics',
]);

export interface PreviewNode {
  id: string;
  type: string;
  label: string;
  content: unknown;
  children: PreviewNode[];
  placeholder?: boolean;
}

/** Converts a builder-neutral Blueprint to a deterministic, safe preview tree. */
export function createPreviewTree(
  input: unknown,
  pageId: string,
  editorMode = false,
): PreviewNode[] {
  const blueprint = normalizeBlueprint(
    structuredClone(input) as Record<string, unknown>,
  );
  const pages = (blueprint.pages ?? []) as Record<string, unknown>[];
  const page = pages.find(
    (candidate) => candidate.id === pageId || candidate.slug === pageId,
  );
  if (!page) throw new Error(`Preview page "${pageId}" was not found`);
  return ((page.sections ?? []) as Record<string, unknown>[])
    .filter((s) => s.hidden !== true)
    .map((section) => {
      const type = String(section.type ?? 'unknown');
      if (!supportedPreviewSections.has(type)) {
        if (!editorMode)
          throw new Error(`Unsupported preview component: ${type}`);
        return {
          id: String(section.id),
          type,
          label: 'Unsupported section',
          content: null,
          children: [],
          placeholder: true,
        };
      }
      return {
        id: String(section.id),
        type,
        label: sanitizeText(section.label ?? type),
        content: null,
        children: ((section.components ?? []) as Record<string, unknown>[]).map(
          (block) => ({
            id: String(block.id),
            type: String(block.type ?? 'text'),
            label: sanitizeText(block.label ?? block.type ?? 'Content'),
            content: sanitizeValue(block),
            children: [],
          }),
        ),
      };
    });
}

export function sanitizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/(?:javascript|data):/gi, '')
    .slice(0, 10000);
}
function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /^on/i.test(k) ? undefined : sanitizeValue(v),
      ]),
    );
  return typeof value === 'string' ? sanitizeText(value) : value;
}

/** Adds IDs only where absent; existing IDs are never changed. */
export function normalizeBlueprint<T extends Record<string, unknown>>(
  blueprint: T,
): T {
  const pages = (blueprint.pages ?? []) as Record<string, unknown>[];
  pages.forEach((page, pi) => {
    page.id ??= stableId('page', `${page.slug ?? pi}`);
    ((page.sections ?? []) as Record<string, unknown>[]).forEach(
      (section, si) => {
        section.id ??= stableId(
          'section',
          `${page.id}.${section.type ?? si}.${si}`,
        );
        ((section.components ?? []) as Record<string, unknown>[]).forEach(
          (block, bi) => {
            block.id ??= stableId(
              'block',
              `${section.id}.${block.type ?? bi}.${bi}`,
            );
            block.fieldId ??= stableId('field', String(block.id));
          },
        );
      },
    );
  });
  return blueprint;
}
function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (const c of value) {
    hash ^= c.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

export interface PatchOperation {
  path: string;
  value: unknown;
}
export function applyPreviewPatches<T>(
  value: T,
  operations: readonly PatchOperation[],
): T {
  const copy = structuredClone(value);
  for (const operation of operations) {
    const parts = operation.path.split('.');
    let cursor = copy as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++)
      cursor = cursor[parts[i]!] as Record<string, unknown>;
    cursor[parts.at(-1)!] = structuredClone(operation.value);
  }
  return copy;
}

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}
export function historyReducer<T>(
  state: History<T>,
  action: { type: 'set'; value: T } | { type: 'undo' } | { type: 'redo' },
): History<T> {
  if (action.type === 'set')
    return {
      past: [...state.past, state.present],
      present: action.value,
      future: [],
    };
  if (action.type === 'undo' && state.past.length) {
    return {
      past: state.past.slice(0, -1),
      present: state.past.at(-1)!,
      future: [state.present, ...state.future],
    };
  }
  if (action.type === 'redo' && state.future.length)
    return {
      past: [...state.past, state.present],
      present: state.future[0]!,
      future: state.future.slice(1),
    };
  return state;
}
