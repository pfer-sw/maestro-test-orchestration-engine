/**
 * calculate-coverage.js
 * Map JUnit XML test results to the taxonomy and compute coverage percentages.
 *
 * Usage:
 *   node scripts/calculate-coverage.js [--flavor=<id>|all]   (flavor ids from config/flavors.json)
 */

import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import minimist from 'minimist';

import {
  loadTaxonomy, saveTaxonomy, updateFlowCoverage,
  recomputeSummary, writeCoverageSnapshot, getFlowsForFlavor
} from './lib/coverage-tracker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = minimist(process.argv.slice(2));
const flavorArg = args.flavor ?? 'all';

const flavorsConfig = JSON.parse(readFileSync(resolve(ROOT, 'config', 'flavors.json'), 'utf8'));
const globalConfig = JSON.parse(readFileSync(resolve(ROOT, 'config', 'global.json'), 'utf8'));

const targetFlavors = flavorArg === 'all'
  ? Object.keys(flavorsConfig.flavors)
  : [flavorArg];

// ── JUnit XML Parsing ─────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['testsuite', 'testcase'].includes(name),
});

/**
 * Parse a JUnit XML file and return an array of test results.
 * Each result: { name, classname, time, passed, error }
 */
function parseJUnitFile(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf8');
  const parsed = xmlParser.parse(xml);
  const suites = parsed?.testsuites?.testsuite ?? [parsed?.testsuite].filter(Boolean);
  const results = [];

  for (const suite of suites) {
    const cases = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase].filter(Boolean);
    for (const tc of cases) {
      results.push({
        name: tc['@_name'] ?? '',
        classname: tc['@_classname'] ?? '',
        time: parseFloat(tc['@_time'] ?? '0') * 1000,
        passed: !tc.failure && !tc.error,
        error: tc.failure?.['#text'] ?? tc.error?.['#text'] ?? null,
      });
    }
  }
  return results;
}

/**
 * Find all JUnit XML files in the reports/raw directory.
 */
function findJUnitFiles(rawDir) {
  if (!existsSync(rawDir)) return [];
  return readdirSync(rawDir)
    .filter((f) => f.endsWith('.xml'))
    .map((f) => resolve(rawDir, f));
}

/**
 * Match a JUnit test result to a taxonomy flow by flowFile path or name.
 * Maestro JUnit output uses the flow file path or name as the test name.
 */
function matchResultToFlow(testResult, flows) {
  // Try exact flowFile path match
  const byFile = flows.find((f) =>
    f.flowFile && testResult.name.includes(f.flowFile.replace(/\\/g, '/'))
  );
  if (byFile) return byFile;

  // Try flow name match
  const byName = flows.find((f) =>
    f.name && testResult.name.toLowerCase().includes(f.name.toLowerCase())
  );
  if (byName) return byName;

  return null;
}

// ── Coverage Report Printer ───────────────────────────────────────────────────

function printCoverageTable(taxonomy, flavors) {
  console.log('\n── Coverage by Feature ──────────────────────────────────────────────────');

  const header = ['Feature', ...flavors.map((f) => f.padStart(10))].join(' | ');
  console.log(header);
  console.log('─'.repeat(header.length));

  for (const feature of taxonomy.features) {
    const cells = [feature.name.slice(0, 20).padEnd(20)];
    for (const flavorId of flavors) {
      if (!feature.appliesTo.includes(flavorId)) {
        cells.push('N/A'.padStart(10));
        continue;
      }
      const flows = feature.flows.filter((f) => f.coverage[flavorId]);
      const covered = flows.filter((f) => f.coverage[flavorId]?.status === 'covered').length;
      const pct = flows.length > 0 ? Math.round((covered / flows.length) * 100) : 0;
      cells.push(`${covered}/${flows.length} (${pct}%)`.padStart(10));
    }
    console.log(cells.join(' | '));
  }

  console.log('─'.repeat(header.length));
  const totals = ['TOTAL'.padEnd(20)];
  for (const flavorId of flavors) {
    const s = taxonomy.coverageSummary[flavorId];
    if (!s) { totals.push('N/A'.padStart(10)); continue; }
    const str = `${s.covered}/${s.total} (${s.coveragePercent}%)`;
    totals.push(str.padStart(10));
  }
  console.log(totals.join(' | '));
  console.log('');

  for (const flavorId of flavors) {
    const s = taxonomy.coverageSummary[flavorId];
    if (!s) continue;
    const status = s.targetMet ? '✓ TARGET MET' : '✗ BELOW TARGET';
    console.log(`${flavorId}: ${s.coveragePercent}% / target ${s.target}% → ${status}`);
    if (s.failing > 0) console.log(`   ⚠ ${s.failing} failing flow(s) need attention`);
  }
  console.log('');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const taxonomy = loadTaxonomy();
  const rawDir = resolve(ROOT, globalConfig.reporting.rawDir ?? 'reports/raw');
  const junitFiles = findJUnitFiles(rawDir);

  console.log(`\n📊 Calculating coverage`);
  console.log(`   JUnit files found: ${junitFiles.length}`);
  console.log(`   Flavors: ${targetFlavors.join(', ')}\n`);

  // Parse all JUnit results
  const allResults = [];
  for (const xmlPath of junitFiles) {
    try {
      const results = parseJUnitFile(xmlPath);
      allResults.push(...results);
      console.log(`   Parsed: ${xmlPath} (${results.length} tests)`);
    } catch (err) {
      console.warn(`   ⚠ Could not parse ${xmlPath}: ${err.message}`);
    }
  }

  // Match results to taxonomy flows and update coverage
  let matched = 0;
  for (const flavorId of targetFlavors) {
    if (!flavorsConfig.flavors[flavorId]) continue;
    const flows = getFlowsForFlavor(taxonomy, flavorId);

    for (const result of allResults) {
      const flow = matchResultToFlow(result, flows);
      if (!flow) continue;

      matched++;
      updateFlowCoverage(taxonomy, flow.id, flavorId, {
        status: result.passed ? 'covered' : 'failing',
        lastResult: result.passed ? 'pass' : 'fail',
        lastRunDate: new Date().toISOString(),
        lastRunDurationMs: result.time,
        failureReason: result.error?.slice(0, 500) ?? null,
      });
    }
  }

  console.log(`   Matched ${matched} test results to taxonomy flows`);

  // Recompute summaries
  recomputeSummary(taxonomy);
  saveTaxonomy(taxonomy);

  // Write snapshots
  const snapshotPaths = [];
  for (const flavorId of targetFlavors) {
    if (!flavorsConfig.flavors[flavorId]) continue;
    const snapshotPath = writeCoverageSnapshot(taxonomy, flavorId);
    snapshotPaths.push(snapshotPath);
    console.log(`   📁 Snapshot: ${snapshotPath}`);
  }

  // Print coverage table
  printCoverageTable(taxonomy, targetFlavors);
}

main().catch((err) => {
  console.error('Coverage calculation failed:', err);
  process.exit(1);
});
