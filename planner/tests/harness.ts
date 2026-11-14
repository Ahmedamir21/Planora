/**
 * Node harness for the merged scheduler core — no DOM required.
 * Run via:  npx esbuild tests/harness.ts --bundle --platform=node --format=esm --outfile=/tmp/harness.mjs && node /tmp/harness.mjs
 */

import './harness/p1-basics';
import './harness/p2-engine';
import './harness/p3-share';
import './harness/p4-storage';
import './harness/p5-options';
import './harness/p6-majors';
import './harness/p7-credits';
import './harness/p8-assistant-locks';
import { stats } from './harness/shared';

console.log(`\n${stats.pass} passed, ${stats.fail} failed`);
process.exit(stats.fail ? 1 : 0);
