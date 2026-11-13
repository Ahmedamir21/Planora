import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

// The source worker stays stable; each built index produces different worker bytes.
// This makes the browser detect new releases and show the update prompt.
const html = readFileSync(new URL('../dist/index.html', import.meta.url));
const filename = new URL('../dist/service-worker.js', import.meta.url);
const worker = readFileSync(filename, 'utf8');
const hash = createHash('sha256').update(html).digest('hex').slice(0, 12);
if (!worker.includes('__BUILD_HASH__')) throw new Error('Missing service worker build placeholder');
writeFileSync(filename, worker.replaceAll('__BUILD_HASH__', hash));
console.log(`Service worker build: ${hash}`);
