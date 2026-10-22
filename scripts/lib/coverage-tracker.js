/**
 * coverage-tracker.js
 * Read/write taxonomy.json — the single source of truth for all feature/flow coverage state.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const TAXONOMY_PATH = resolve(ROOT, 'coverage', 'taxonomy.json');
const DRIFT_PATH = resolve(ROOT, 'coverage', 'taxonomy.drift.json');
const FLAVORS_PATH = resolve(ROOT, 'config', 'flavors.json');

function loadFlavors() {
  return existsSync(FLAVORS_PATH)
    ? JSON.parse(readFileSync(FLAVORS_PATH, 'utf8')).flavors ?? {}
    : {};
}

/** Flavor ids defined in config/flavors.json (falls back to the taxonomy's coverageSummary keys). */
export function getFlavorIds(taxonomy) {
  const ids = Object.keys(loadFlavors());
  if (ids.length) return ids;
  return Object.keys(taxonomy?.coverageSummary ?? {});
}

export function loadTaxonomy() {
  if (!existsSync(TAXONOMY_PATH)) {
    throw new Error(`taxonomy.json not found at ${TAXONOMY_PATH}`);
  }
  return JSON.parse(readFileSync(TAXONOMY_PATH, 'utf8'));
}

export function saveTaxonomy(taxonomy) {
  taxonomy.lastUpdated = new Date().toISOString();
  writeFileSync(TAXONOMY_PATH, JSON.stringify(taxonomy, null, 2), 'utf8');
}

export function logDrift(entry) {
  let drift = [];
  if (existsSync(DRIFT_PATH)) {
    drift = JSON.parse(readFileSync(DRIFT_PATH, 'utf8'));
  }
  drift.push({ timestamp: new Date().toISOString(), ...entry });
  writeFileSync(DRIFT_PATH, JSON.stringify(drift, null, 2), 'utf8');
}

/** Get all flows for a given flavor, flattened with featureId context. */
export function getFlowsForFlavor(taxonomy, flavorId) {
  const flows = [];
  for (const feature of taxonomy.features) {
    if (!feature.appliesTo.includes(flavorId)) continue;
    for (const flow of feature.flows) {
      if (!flow.coverage[flavorId]) continue;
      flows.push({ ...flow, featureId: feature.id, featureName: feature.name });
    }
  }
  return flows;
}

/** Get flows filtered by group and sorted by priority. */
export function getExecutionPlan(taxonomy, flavorId, group = 'all') {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const groupMap = {
    baseline: (f) => f.tags?.includes('baseline'),
    feature: (f) => !f.tags?.includes('baseline') && !f.tags?.includes('ai'),
    ai: (f) => f.tags?.includes('ai'),
    all: () => true,
  };
  const filter = groupMap[group] ?? groupMap.all;
  // Baseline first so the circuit breaker trips before anything depends on it.
  const groupRank = (f) => (groupMap.baseline(f) ? 0 : groupMap.ai(f) ? 2 : 1);

  return getFlowsForFlavor(taxonomy, flavorId)
    .filter((f) => f.coverage[flavorId]?.status !== 'skipped')
    .filter(filter)
    .sort((a, b) => groupRank(a) - groupRank(b)
      || (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));
}

/** Update a single flow's coverage entry for a flavor. */
export function updateFlowCoverage(taxonomy, flowId, flavorId, update) {
  for (const feature of taxonomy.features) {
    for (const flow of feature.flows) {
      if (flow.id === flowId) {
        if (!flow.coverage[flavorId]) flow.coverage[flavorId] = {};
        Object.assign(flow.coverage[flavorId], update);
        return true;
      }
    }
  }
  return false;
}

/** Add a newly discovered screen/flow to the taxonomy. */
export function addDiscoveredFlow(taxonomy, featureId, flowEntry) {
  let feature = taxonomy.features.find((f) => f.id === featureId);
  if (!feature) {
    feature = {
      id: featureId,
      name: featureId,
      description: `Discovered by Claude explorer`,
      appliesTo: [flowEntry.flavorId],
      flows: [],
    };
    taxonomy.features.push(feature);
  }
  const existing = feature.flows.find((f) => f.id === flowEntry.id);
  if (!existing) {
    feature.flows.push(flowEntry);
  }
}

/** Recompute and update the coverageSummary block. */
export function recomputeSummary(taxonomy) {
  const flavors = getFlavorIds(taxonomy);
  const flavorConfig = loadFlavors();
  taxonomy.coverageSummary ??= {};
  for (const flavor of flavors) {
    const flows = getFlowsForFlavor(taxonomy, flavor);
    const summary = {
      total: flows.length,
      covered: 0,
      failing: 0,
      not_covered: 0,
      discovered: 0,
      skipped: 0,
      coveragePercent: 0,
      target: flavorConfig[flavor]?.coverageTarget ?? 80,   // config/flavors.json is the source
      targetMet: false,
    };
    for (const flow of flows) {
      const status = flow.coverage[flavor]?.status ?? 'not_covered';
      if (summary[status] !== undefined) summary[status]++;
    }
    const eligible = summary.total - summary.skipped;
    summary.coveragePercent = eligible > 0
      ? Math.round((summary.covered / eligible) * 100 * 10) / 10
      : 0;
    summary.targetMet = summary.coveragePercent >= summary.target;
    taxonomy.coverageSummary[flavor] = summary;
  }
}

/** Write a coverage snapshot to coverage/snapshots/{timestamp}/{flavor}.coverage.json */
export function writeCoverageSnapshot(taxonomy, flavorId) {
  const ts = new Date().toISOString().replace(/:/g, '-').replace('T', '_').slice(0, 16);
  const dir = resolve(ROOT, 'coverage', 'snapshots', ts);
  mkdirSync(dir, { recursive: true });
  const snapshot = {
    runId: new Date().toISOString(),
    flavor: flavorId,
    summary: taxonomy.coverageSummary[flavorId],
    byFeature: {},
    failingFlows: [],
  };
  for (const feature of taxonomy.features) {
    if (!feature.appliesTo.includes(flavorId)) continue;
    const flows = feature.flows.filter((f) => f.coverage[flavorId]);
    const covered = flows.filter((f) => f.coverage[flavorId].status === 'covered').length;
    snapshot.byFeature[feature.id] = {
      name: feature.name,
      total: flows.length,
      covered,
      percent: flows.length > 0 ? Math.round((covered / flows.length) * 100) : 0,
    };
    for (const flow of flows) {
      if (flow.coverage[flavorId]?.status === 'failing') {
        snapshot.failingFlows.push({
          flowId: flow.id,
          flowFile: flow.flowFile,
          error: flow.coverage[flavorId].failureReason,
        });
      }
    }
  }
  const snapshotPath = resolve(dir, `${flavorId}.coverage.json`);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
  return snapshotPath;
}
