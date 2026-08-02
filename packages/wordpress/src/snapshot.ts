import type { WordPressClient } from './client.js';
import type { WordPressSnapshot } from './types.js';

/** Collects a consistent, read-only snapshot exposed by the SiteFoundry connector. */
export class WordPressSnapshotReader {
  constructor(private readonly client: WordPressClient) {}
  read(): Promise<WordPressSnapshot> {
    return this.client.get('/wp-json/website-generator/v1/snapshot', {
      retry: true,
    });
  }
}
