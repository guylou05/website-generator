import type { ElementorDocument } from '@website-generator/renderer/elementor';
import type { WordPressClient } from './client.js';
export class WordPressElementor {
  constructor(private readonly client: WordPressClient) {}
  savePageData(
    pageId: number,
    document: ElementorDocument,
  ): Promise<{ success: boolean; pageId: number }> {
    return this.client.post(
      `/wp-json/website-generator/v1/pages/${pageId}/elementor`,
      {
        data: document.content,
        settings: document.page_settings,
        version: document.version,
      },
    );
  }
  updateCssMetadata(
    pageId: number,
  ): Promise<{ success: boolean; pageId: number }> {
    return this.client.post(
      `/wp-json/website-generator/v1/pages/${pageId}/css`,
      {},
    );
  }
  regenerateCss(): Promise<{ success: boolean }> {
    return this.client.post(
      '/wp-json/website-generator/v1/elementor/regenerate-css',
      {},
    );
  }
  setPageTemplate(
    pageId: number,
    template:
      | 'elementor_canvas'
      | 'elementor_header_footer'
      | 'default' = 'elementor_canvas',
  ): Promise<{ success: boolean; pageId: number }> {
    return this.client.post(
      `/wp-json/website-generator/v1/pages/${pageId}/template`,
      { template },
    );
  }
}
