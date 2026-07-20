import type { WordPressClient } from './client.js';
export class WordPressSettings {
  constructor(private readonly client: WordPressClient) {}
  setStaticHomepage(
    pageId: number,
  ): Promise<{ success: boolean; pageId: number }> {
    return this.client.post('/wp-json/website-generator/v1/settings/homepage', {
      page_id: pageId,
    });
  }
}
