import { cp, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const app = resolve(import.meta.dirname, '..');
const standaloneApp = resolve(app, '.next/standalone/apps/dashboard');
const server = resolve(standaloneApp, 'server.js');

await access(server);
await cp(resolve(app, '.next/static'), resolve(standaloneApp, '.next/static'), {
  recursive: true,
  force: true,
});
try {
  await access(resolve(app, 'public'));
  await cp(resolve(app, 'public'), resolve(standaloneApp, 'public'), {
    recursive: true,
    force: true,
  });
} catch {
  // This app currently has no public directory; keep the startup verifier valid
  // if assets continue to be served entirely from the static build output.
}
console.log(`Verified standalone dashboard server: ${server}`);
