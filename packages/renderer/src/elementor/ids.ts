import { ElementorRenderError } from './types.js';

/** Deterministic ID factory. Elementor IDs are lowercase eight-character hex strings. */
export class ElementorIdFactory {
  private readonly allocated = new Map<string, string>();
  private readonly used = new Set<string>();

  id(scope: string): string {
    const existing = this.allocated.get(scope);
    if (existing) return existing;
    for (let attempt = 0; attempt < 1_000; attempt += 1) {
      const id = hash(`${scope}:${attempt}`);
      if (!this.used.has(id)) {
        this.used.add(id);
        this.allocated.set(scope, id);
        return id;
      }
    }
    throw new ElementorRenderError(
      'Unable to allocate a unique Elementor ID',
      scope,
    );
  }
}

function hash(value: string): string {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}
