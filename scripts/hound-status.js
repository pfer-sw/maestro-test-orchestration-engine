#!/usr/bin/env node
/**
 * hound-status.js — which runs have filed their results in Hound, and which have not.
 * Hound is the mandatory reporting system (docs/workflows/hound-reporting.md): every run with a
 * run folder either files its pass/fail cases on the ticket or states why not (hound.json `skip`).
 *
 * Usage: npm run hound-status        (exit 1 when any run is still to file)
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOTS = ['reports/adhoc', 'reports/features', 'reports/releases'];
let open = 0;
for (const root of ROOTS.filter(existsSync)) {
  for (const dir of readdirSync(root).sort()) {
    const specPath = join(root, dir, 'hound.json');
    const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, 'utf8')) : null;
    let state;
    if (spec?.skip) state = `skipped — ${spec.skip}`;
    else if (!spec) state = '✗ no hound.json (file the results, or {"skip": "<reason>"})';
    else if (!spec.filed) state = '✗ hound.json not filed (npm run hound-report)';
    else state = `✓ filed ${spec.filed.at.slice(0, 10)} on ${spec.filed.tickets.join(', ')}`;
    if (state.startsWith('✗')) open++;
    console.log(`${join(root, dir).padEnd(45)} ${state}`);
  }
}
if (open) {
  console.log(`\n${open} run(s) still to file in Hound.`);
  process.exit(1);
}
