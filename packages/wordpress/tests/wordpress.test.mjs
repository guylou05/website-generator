import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WordPressClient,
  WordPressDeployer,
  WordPressPages,
} from '../dist/index.js';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const credentials = {
  url: 'https://wordpress.example.test',
  username: 'admin-user',
  applicationPassword: 'abcd EFGH 1234',
};
const wpPage = {
  id: 42,
  slug: 'home',
  status: 'draft',
  link: 'https://wordpress.example.test/home/',
  title: { rendered: 'Home' },
  featured_media: 0,
};

function minimalBlueprint() {
  return {
    schemaVersion: '1.0',
    metadata: {},
    branding: { name: 'Example' },
    globalStyles: {},
    defaultSeo: {},
    pages: [{ id: 'page-home', title: 'Home', slug: '', sections: [] }],
    navigation: {
      items: [
        {
          id: 'nav-home',
          label: 'Home',
          href: '/',
          external: false,
          children: [],
        },
      ],
    },
    footer: {
      columns: [],
      socialLinks: [],
      components: [],
      copyright: 'Example',
    },
  };
}

const document = {
  version: '0.4',
  title: 'Home',
  type: 'page',
  page_settings: {},
  content: [],
};

test('uses Application Password authentication without logging credentials', async () => {
  const logs = [];
  let authorization = '';
  const client = new WordPressClient(credentials, {
    fetch: async (_url, init) => {
      authorization = init.headers.Authorization;
      return jsonResponse({
        id: 7,
        slug: 'admin-user',
        capabilities: { manage_options: true },
      });
    },
    logger: {
      debug: (message, context) => logs.push([message, context]),
      info() {},
      warn() {},
      error() {},
    },
  });
  const result = await client.testConnection();
  assert.equal(result.userId, 7);
  assert.match(authorization, /^Basic /);
  assert.ok(!JSON.stringify(logs).includes(credentials.applicationPassword));
  assert.ok(!JSON.stringify(logs).includes(authorization));
});

test('page upsert updates an existing slug and defaults to draft', async () => {
  const requests = [];
  const client = new WordPressClient(credentials, {
    fetch: async (url, init) => {
      requests.push({ url: String(url), method: init.method, body: init.body });
      if (init.method === 'GET') return jsonResponse([wpPage]);
      return jsonResponse(wpPage);
    },
  });
  const result = await new WordPressPages(client).upsert({
    title: 'Home',
    slug: 'home',
  });
  assert.equal(result.action, 'update');
  assert.equal(requests[1].method, 'PUT');
  assert.equal(JSON.parse(requests[1].body).status, 'draft');
});

test('dry run reports updates and performs no write requests', async () => {
  const methods = [];
  const client = new WordPressClient(credentials, {
    fetch: async (url, init) => {
      methods.push(init.method);
      if (String(url).includes('/users/me'))
        return jsonResponse({
          id: 7,
          slug: 'admin-user',
          capabilities: { manage_options: true },
        });
      return jsonResponse([wpPage]);
    },
  });
  const result = await new WordPressDeployer(client).deploy({
    blueprint: minimalBlueprint(),
    elementorPages: { 'page-home': document },
    dryRun: true,
  });
  assert.equal(result.dryRun, true);
  assert.equal(result.pages[0].action, 'update');
  assert.deepEqual(new Set(methods), new Set(['GET']));
  assert.ok(
    result.operations.some((operation) => operation.resource === 'homepage'),
  );
});

test('deployment updates pages and connector metadata idempotently', async () => {
  const requests = [];
  const client = new WordPressClient(credentials, {
    fetch: async (url, init) => {
      const request = {
        url: String(url),
        method: init.method,
        body: init.body ? JSON.parse(init.body) : undefined,
      };
      requests.push(request);
      if (request.url.includes('/users/me'))
        return jsonResponse({
          id: 7,
          slug: 'admin-user',
          capabilities: { manage_options: true },
        });
      if (request.url.includes('/wp/v2/pages?')) return jsonResponse([wpPage]);
      if (request.url.includes('/wp/v2/pages/42')) return jsonResponse(wpPage);
      if (request.url.includes('/menus'))
        return jsonResponse({
          id: 9,
          name: 'Primary Navigation',
          slug: 'primary-navigation',
          action: 'updated',
        });
      return jsonResponse({ success: true, pageId: 42 });
    },
  });
  const result = await new WordPressDeployer(client).deploy({
    blueprint: minimalBlueprint(),
    elementorPages: { 'page-home': document },
  });
  assert.equal(result.pages[0].action, 'update');
  assert.equal(
    requests.find((request) => request.url.includes('/wp/v2/pages/42')).body
      .status,
    'draft',
  );
  assert.ok(
    requests.some((request) => request.url.endsWith('/pages/42/elementor')),
  );
  assert.ok(requests.some((request) => request.url.endsWith('/pages/42/css')));
  assert.ok(
    requests.some((request) => request.url.endsWith('/settings/homepage')),
  );
  assert.ok(
    requests.some((request) =>
      request.url.endsWith('/elementor/regenerate-css'),
    ),
  );
});

test('retries transient GET failures', async () => {
  let attempts = 0;
  const client = new WordPressClient(credentials, {
    maxAttempts: 2,
    fetch: async () => {
      attempts += 1;
      return attempts === 1
        ? jsonResponse({ code: 'server_error', message: 'Try again' }, 503)
        : jsonResponse({
            id: 7,
            slug: 'admin-user',
            capabilities: { manage_options: true },
          });
    },
  });
  await client.testConnection();
  assert.equal(attempts, 2);
});
