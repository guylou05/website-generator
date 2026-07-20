import type { WordPressClient } from './client.js';
import type { ConnectorMenuItem } from './types.js';
export interface ConnectorMenuResult {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly action: 'created' | 'updated';
}
export class WordPressMenus {
  constructor(private readonly client: WordPressClient) {}
  upsert(
    name: string,
    items: readonly ConnectorMenuItem[],
  ): Promise<ConnectorMenuResult> {
    return this.client.post('/wp-json/website-generator/v1/menus', {
      name,
      items,
    });
  }
}
