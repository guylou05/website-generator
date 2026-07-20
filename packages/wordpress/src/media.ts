import type { WordPressClient } from './client.js';
import type { MediaUploadInput, WordPressMedia } from './types.js';

export class WordPressMediaLibrary {
  constructor(private readonly client: WordPressClient) {}
  async findBySlug(slug: string): Promise<WordPressMedia | undefined> {
    const media = await this.client.get<WordPressMedia[]>(
      '/wp-json/wp/v2/media',
      { query: { slug, context: 'edit' } },
    );
    return media[0];
  }
  async upload(input: MediaUploadInput): Promise<WordPressMedia> {
    let body: Blob;
    if (input.bytes instanceof Blob) body = input.bytes;
    else {
      const buffer = new ArrayBuffer(input.bytes.byteLength);
      new Uint8Array(buffer).set(input.bytes);
      body = new Blob([buffer], { type: input.mimeType });
    }
    const media = await this.client.request<WordPressMedia>(
      '/wp-json/wp/v2/media',
      {
        rawBody: body,
        headers: {
          'Content-Type': input.mimeType,
          'Content-Disposition': contentDisposition(input.filename),
        },
      },
      'POST',
    );
    if (input.title || input.altText)
      return this.client.put(`/wp-json/wp/v2/media/${media.id}`, {
        ...(input.title ? { title: input.title } : {}),
        ...(input.altText ? { alt_text: input.altText } : {}),
      });
    return media;
  }
}
function contentDisposition(filename: string): string {
  const safe = filename.replace(/["\r\n\\/]/g, '_');
  return `attachment; filename="${safe}"`;
}
