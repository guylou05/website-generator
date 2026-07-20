import type { WordPressClient } from './client.js';
import type {
  PageWriteInput,
  WordPressPage,
  WordPressPageStatus,
} from './types.js';

export class WordPressPages {
  constructor(private readonly client: WordPressClient) {}
  async findBySlug(slug: string): Promise<WordPressPage | undefined> {
    const pages = await this.client.get<WordPressPage[]>(
      '/wp-json/wp/v2/pages',
      {
        query: {
          slug,
          context: 'edit',
          status: 'draft,pending,private,publish,future',
        },
      },
    );
    return pages[0];
  }
  create(input: PageWriteInput): Promise<WordPressPage> {
    return this.client.post('/wp-json/wp/v2/pages', payload(input));
  }
  update(id: number, input: PageWriteInput): Promise<WordPressPage> {
    return this.client.put(`/wp-json/wp/v2/pages/${id}`, payload(input));
  }
  async upsert(
    input: PageWriteInput,
  ): Promise<{ page: WordPressPage; action: 'create' | 'update' }> {
    const existing = await this.findBySlug(input.slug);
    if (existing)
      return { page: await this.update(existing.id, input), action: 'update' };
    return { page: await this.create(input), action: 'create' };
  }
  setFeaturedImage(id: number, mediaId: number): Promise<WordPressPage> {
    return this.client.put(`/wp-json/wp/v2/pages/${id}`, {
      featured_media: mediaId,
    });
  }
}
function payload(input: PageWriteInput): Record<string, unknown> {
  const status: WordPressPageStatus = input.status ?? 'draft';
  return {
    title: input.title,
    slug: input.slug,
    status,
    content: input.content ?? '',
    ...(input.featuredMediaId === undefined
      ? {}
      : { featured_media: input.featuredMediaId }),
  };
}
