#!/usr/bin/env node
/**
 * hound-report.js — file a run's results and evidence on a Gyro ticket's Hound section.
 *
 * Input: a spec JSON (usually next to the run's report, e.g. reports/adhoc/<run>/hound.json):
 *   {
 *     "ticket": "PRJ-123", "project": "prj", "platform": "android",   // project: or HOUND_PROJECT
 *     "execution": "automated",                    // Claude-driven run; "manual" = the tester did the steps
 *     "notesPrefix": "Android 8.7.0 (8229) · …",   // prepended to every case's notes
 *     "cases": [{
 *       "key": "PRJ-T12",                           // omit → the case is created from `definition`
 *       "definition": { "title", "description", "preconditions", "steps": [{action, expected}],
 *                       "platforms": ["android"], "persona": "<persona key>",
 *                       "componentId": 1, "folderPath": "/Area/Feature" },   // folder must exist
 *       "status": "passed",                        // passed | failed | blocked | not_run | not_applicable
 *       "notes": "…",
 *       "ticket": "PRJ-124",                       // optional: file this case on another ticket
 *       "notApplicable": ["ios"],                  // optional: platforms filed not_applicable (scope backend)
 *       "evidence": ["screenshots/test_runs/<date>/<label>.png"]
 *     }]
 *   }
 * Created case keys are written back into the spec, so a re-run reports to the same cases.
 * Re-runs replace the slot's evidence (clearEvidence).
 *
 * A run that verifies no ticket writes { "skip": "<reason>" } instead (docs/workflows/hound-reporting.md).
 *
 * Usage: npm run hound-report -- <spec.json> [--dry-run]
 */
import { existsSync as fileExists, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';
import minimist from 'minimist';
import {
  getTicket, listPersonas, createTestCase, reportResults, uploadEvidence, getTicketHound, ticketUrl,
} from './lib/hound-client.js';

const args = minimist(process.argv.slice(2), { boolean: ['dry-run'] });
const specPath = args._[0];
if (!specPath) {
  console.error('Usage: npm run hound-report -- <spec.json> [--dry-run]');
  process.exit(1);
}
const dryRun = args['dry-run'];
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
if (spec.skip) {
  console.log(`Not filed in Hound: ${spec.skip}`);
  process.exit(0);
}
const project = spec.project ?? process.env.HOUND_PROJECT;
if (!project) throw new Error('No Hound project: set "project" in the spec or HOUND_PROJECT in .env');
const platform = spec.platform ?? 'android';
const CONTENT_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.gif': 'image/gif' };

// A created case's key also goes into the run's run.json, so the report and the next spec name it.
const runPath = join(dirname(specPath), 'run.json');
function keyIntoRun(c) {
  if (!c.runCase || !fileExists(runPath)) return;
  const run = JSON.parse(readFileSync(runPath, 'utf8'));
  const runCase = run.cases?.find((rc) => rc.id === c.runCase);
  if (!runCase?.hound) return;
  runCase.hound.key = c.key;
  writeFileSync(runPath, `${JSON.stringify(run, null, 1)}\n`);
}

// 1. Create the cases the spec does not have a key for yet.
const personas = await listPersonas(project);
for (const c of spec.cases) {
  if (c.key) continue;
  const { persona, ...definition } = c.definition;
  const match = personas.find((p) => p.key === persona);
  if (!match) throw new Error(`Persona "${persona}" not in project ${project}: ${personas.map((p) => p.key).join(', ')}`);
  if (dryRun) {
    console.log(`  [dry-run] would create case "${definition.title}" (persona ${persona} #${match.id})`);
    continue;
  }
  const created = await createTestCase(project, { ...definition, personaId: match.id });
  c.key = created.key;
  writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
  keyIntoRun(c);
  console.log(`  created ${c.key}: ${definition.title}`);
}

// 2–4. Per ticket (a case's own `ticket` overrides the spec's): results in one call, evidence, read-back.
const byTicket = new Map();
for (const c of spec.cases) {
  const key = c.ticket ?? spec.ticket;
  byTicket.set(key, [...(byTicket.get(key) ?? []), c]);
}
for (const [ticketKey, cases] of byTicket) {
  const ticket = await getTicket(ticketKey);
  console.log(`Ticket ${ticketKey} (#${ticket.id}): ${ticket.title}`);

  const results = cases.flatMap((c) => [
    {
      testCase: c.key ?? `<new: ${c.definition.title}>`,
      platform,
      status: c.status,
      execution: spec.execution ?? 'automated',
      notes: [spec.notesPrefix, c.notes].filter(Boolean).join('\n'),
      clearEvidence: Boolean(c.evidence?.length),
    },
    // Backend/AI-only change: the result does not depend on the client.
    ...(c.notApplicable ?? []).map((other) => ({
      testCase: c.key ?? `<new: ${c.definition.title}>`,
      platform: other,
      status: 'not_applicable',
      execution: spec.execution ?? 'automated',
      notes: `Backend/AI change, platform-independent: verified through the ${platform} client (${c.status}).`,
    })),
  ]);
  if (dryRun) {
    console.log('  [dry-run] results:', JSON.stringify(results, null, 2));
  } else {
    const res = await reportResults(ticket.id, results);
    console.log(`  results filed${res.fallback ? ` (via ${res.fallback})` : ''}`);
  }

  for (const c of cases) {
    for (const file of c.evidence ?? []) {
      const contentType = CONTENT_TYPES[extname(file).toLowerCase()];
      if (!contentType) throw new Error(`Unsupported evidence type: ${file}`);
      const buffer = readFileSync(resolve(file));
      if (dryRun) {
        console.log(`  [dry-run] would upload ${file} (${(buffer.length / 1024).toFixed(0)} KB) → ${c.key ?? c.definition.title}`);
        continue;
      }
      await uploadEvidence(ticket.id, c.key, platform, { fileName: basename(file), contentType, buffer });
      console.log(`  evidence ${basename(file)} → ${c.key}`);
    }
  }

  if (!dryRun) {
    const hound = await getTicketHound(ticket.id);
    for (const c of hound.cases ?? []) {
      const runs = c.runs.map((r) => `${r.platform} ${r.status}`).join(', ');
      console.log(`  ${c.testCase?.key ?? c.testCase}: ${runs} · ${c.evidence?.length ?? 0} evidence file(s)`);
    }
    console.log(ticketUrl(ticketKey));
  }
}

// Proof of filing, read by `npm run hound-status`.
if (!dryRun) {
  spec.filed = { at: new Date().toISOString(), tickets: [...byTicket.keys()] };
  writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
}
