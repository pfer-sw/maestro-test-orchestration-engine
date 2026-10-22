/**
 * explore.js
 * Phase 1: Claude-driven BFS exploration of the app.
 *
 * Usage:
 *   node scripts/explore.js --flavor=main
 *   (any flavor id defined in config/flavors.json)
 *
 * When Claude invokes this as part of its operating instructions (CLAUDE.md),
 * it uses the maestro-mcp MCP tools directly. When run via node CLI, it
 * uses the maestro CLI wrappers in scripts/lib/maestro-client.js.
 *
 * The exploration algorithm is designed to be driven by Claude's analysis
 * of screenshots. Claude reads each screenshot, identifies screens and
 * elements, and calls this script's helpers to persist the results.
 */

import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import minimist from 'minimist';

import { loadTaxonomy, saveTaxonomy, addDiscoveredFlow, recomputeSummary } from './lib/coverage-tracker.js';
import { resolveDevice, connectDevice, takeScreenshot, validateFlow, expandEnv } from './lib/maestro-client.js';
import { getAccount, getEnvVars } from './lib/account-manager.js';
import { saveGeneratedFlow, buildScreenAnalysisPrompt, buildFlowGenerationPrompt } from './lib/flow-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = minimist(process.argv.slice(2));
const flavorId = args.flavor;

const flavorsConfig = JSON.parse(readFileSync(resolve(ROOT, 'config', 'flavors.json'), 'utf8'));
const globalConfig = JSON.parse(readFileSync(resolve(ROOT, 'config', 'global.json'), 'utf8'));
const knownFlavors = Object.keys(flavorsConfig.flavors ?? {});

if (!flavorId || !knownFlavors.includes(flavorId)) {
  if (flavorId) console.error(`Unknown flavor: ${flavorId}`);
  console.error(`Usage: node scripts/explore.js --flavor=<${knownFlavors.join('|')}>`);
  process.exit(1);
}

const flavor = flavorsConfig.flavors[flavorId];

// ── Main Exploration Orchestration ────────────────────────────────────────────

console.log(`\n🔍 Starting exploration for flavor: ${flavor.displayName}`);
console.log(`   Package: ${flavor.app.packageName}`);
console.log(`   Max depth: ${globalConfig.exploration.maxDepth}\n`);

const taxonomy = loadTaxonomy();

// Resolve the default account for this flavor and build env vars for flows
const defaultAccount = getAccount(flavor.defaultAccountId);
const env = { ...expandEnv(flavor.env), ...getEnvVars(defaultAccount) };
console.log(`   Account: ${defaultAccount.id} (${defaultAccount.email})`);

const screenshotDir = resolve(ROOT, globalConfig.exploration.screenshotDir, flavorId);
const maxDepth = globalConfig.exploration.maxDepth;

// State
const discoveryQueue = [{ screenId: 'launch', depth: 0 }];
const visitedScreens = new Set();
let flowsGenerated = 0;
let screensDiscovered = 0;

/**
 * Takes a screenshot and saves it with a timestamped name.
 */
async function captureScreen(screenId) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const screenshotPath = resolve(screenshotDir, `${ts}_${screenId}_exploration.png`);
  const result = await takeScreenshot(screenshotPath);
  return result.success ? screenshotPath : null;
}

/**
 * NOTE FOR CLAUDE (when running via MCP):
 *
 * When you reach this point in the exploration loop, you should:
 *
 * 1. Call maestro_screenshot to capture the current screen
 * 2. Read the screenshot file
 * 3. Use the template in prompts/exploration/screen-analysis.md to analyze it
 * 4. The analysis should return a JSON with: screenId, screenName, elements[],
 *    navigationTargets[], isAiInterface, suggestedFlows[]
 * 5. Call this function with the analysis result to persist it
 */
function processScreenAnalysis(analysisResult, currentDepth) {
  const { screenId, screenName, elements, navigationTargets, isAiInterface, suggestedFlows } = analysisResult;

  if (visitedScreens.has(screenId)) {
    console.log(`   ↩ Already visited: ${screenId}`);
    return;
  }
  visitedScreens.add(screenId);
  screensDiscovered++;

  console.log(`\n📱 Screen: ${screenName} (${screenId})`);
  console.log(`   Elements: ${elements?.length ?? 0}, Nav targets: ${navigationTargets?.length ?? 0}`);

  // Add to taxonomy if not already present
  const featureId = screenId.split('_')[0] || screenId;
  const flowId = `${featureId}.${screenId}_explore`;
  addDiscoveredFlow(taxonomy, featureId, {
    id: flowId,
    name: `Explore: ${screenName}`,
    description: `Auto-discovered during exploration of ${flavor.displayName}`,
    flowFile: null,
    priority: 'medium',
    tags: ['generated', 'exploration'],
    flavorId,
    coverage: {
      [flavorId]: { status: 'discovered', lastRunDate: null, lastResult: null, lastRunDurationMs: null, failureReason: null },
    },
  });

  // Enqueue navigation targets if within depth limit
  if (currentDepth < maxDepth && navigationTargets) {
    for (const target of navigationTargets) {
      if (!visitedScreens.has(target)) {
        discoveryQueue.push({ screenId: target, depth: currentDepth + 1 });
      }
    }
  } else if (currentDepth >= maxDepth) {
    console.log(`   ⚠ Max depth (${maxDepth}) reached — navigation targets not enqueued`);
  }

  // For flavors with aiTesting enabled: note if this screen has an LLM interface
  if (isAiInterface && flavor.aiTesting?.enabled) {
    console.log(`   🤖 AI interface detected — meta-test flows will be generated`);
    generateAiMetaTestFlows(screenId, screenName, elements);
  }

  return suggestedFlows;
}

/**
 * NOTE FOR CLAUDE (when running via MCP):
 *
 * For each suggestedFlow, use prompts/exploration/flow-generation.md to
 * generate valid Maestro YAML. Then call maestro_validate_flow.
 * If valid, save to flows/generated/{flavorId}/{date}/
 * If invalid after 3 attempts, keep as "discovered" and continue.
 */
async function generateAndValidateFlow(flowId, yamlContent, flavorId) {
  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    const tempPath = resolve(ROOT, 'flows', 'generated', flavorId, `_temp_${flowId}.yaml`);
    const { mkdirSync } = await import('fs');
    mkdirSync(resolve(ROOT, 'flows', 'generated', flavorId), { recursive: true });
    const { writeFileSync } = await import('fs');
    writeFileSync(tempPath, yamlContent, 'utf8');

    const validation = await validateFlow(tempPath);
    if (validation.valid) {
      const savedPath = saveGeneratedFlow(flavorId, flowId, yamlContent);
      flowsGenerated++;
      console.log(`   ✓ Flow saved: ${savedPath}`);
      return savedPath;
    } else {
      console.log(`   ✗ Validation failed (attempt ${attempts}): ${validation.error?.slice(0, 80)}`);
      // NOTE FOR CLAUDE: Re-attempt generation with the error message as context
    }
  }
  console.log(`   ⚠ Could not generate valid flow for ${flowId} after 3 attempts — marked as discovered`);
  return null;
}

/**
 * Generate the 5 AI meta-test flow stubs for an AI interface screen.
 */
function generateAiMetaTestFlows(screenId, screenName, elements) {
  const aiConfig = flavor.aiTesting;
  if (!aiConfig?.enabled) return;

  const categories = aiConfig.metaTestCategories;
  for (const category of categories) {
    const flowId = `ai_assistant.${category}.${screenId}`;
    const flowPath = resolve(ROOT, 'flows', 'ai', getCategoryFlowDir(category));
    console.log(`   📝 AI meta-test stub: ${category} → ${flowPath}`);
    // NOTE FOR CLAUDE: Use prompts/ai-flavor/test-cases.md to generate
    // actual YAML content for each category, then validate and save
  }
}

function getCategoryFlowDir(category) {
  const map = {
    happy_path: 'prompts/happy_path_prompt.yaml',
    ambiguous_input: 'prompts/ambiguous_prompt.yaml',
    out_of_scope: 'prompts/out_of_scope_prompt.yaml',
    adversarial: 'prompts/adversarial_prompt.yaml',
    edge_cases: 'edge_cases/',
  };
  return map[category] ?? `prompts/${category}.yaml`;
}

// ── Device Connection ─────────────────────────────────────────────────────────

async function connectToDevice() {
  const device = await resolveDevice(flavor.device);
  console.log(`📱 Connecting to device: ${device.id} (${device.name})`);
  const conn = await connectDevice(device.id);
  if (!conn.connected) {
    console.warn(`⚠ Could not connect to ${device.id}: ${conn.error}`);
    console.warn('Ensure the device is connected via adb and the app is pre-installed.');
  }
  return device;
}

// ── Entry Point ───────────────────────────────────────────────────────────────

async function main() {
  const device = await connectToDevice();

  // ─────────────────────────────────────────────────────────────────────────
  // EXPLORATION LOOP
  // NOTE FOR CLAUDE: This is where you drive the BFS discovery.
  //
  // The loop below is the scaffold. At each iteration:
  //   1. Call maestro_screenshot
  //   2. Analyze the screenshot using prompts/exploration/screen-analysis.md
  //   3. Call processScreenAnalysis() with the result
  //   4. For each suggestedFlow, generate YAML and call generateAndValidateFlow()
  //   5. Navigate to the next screen (tap on a navigation element)
  //   6. Repeat for each item in the discovery queue
  //
  // When running via `node scripts/explore.js`, this will print guidance
  // about what Claude should do at each step.
  // ─────────────────────────────────────────────────────────────────────────

  let processedCount = 0;
  while (discoveryQueue.length > 0) {
    const { screenId, depth } = discoveryQueue.shift();
    if (visitedScreens.has(screenId)) continue;

    processedCount++;
    console.log(`\n[${processedCount}] Processing: ${screenId} (depth: ${depth})`);
    console.log(`   Queue remaining: ${discoveryQueue.length}`);

    // Capture screen
    const screenshotPath = await captureScreen(screenId);
    if (screenshotPath) {
      console.log(`   📸 Screenshot: ${screenshotPath}`);
    }

    // NOTE FOR CLAUDE: Here you analyze the screenshot and call processScreenAnalysis()
    // For script mode: mark as discovered so the taxonomy is populated
    processScreenAnalysis({
      screenId,
      screenName: screenId,
      elements: [],
      navigationTargets: [],
      isAiInterface: false,
      suggestedFlows: [],
    }, depth);

    // Save taxonomy after each screen to avoid data loss on interruption
    recomputeSummary(taxonomy);
    saveTaxonomy(taxonomy);
  }

  // ── Final Summary ──────────────────────────────────────────────────────────
  recomputeSummary(taxonomy);
  taxonomy.updatedBy = 'claude-explorer';
  saveTaxonomy(taxonomy);

  const summary = taxonomy.coverageSummary[flavorId];
  console.log(`\n✅ Exploration complete for: ${flavor.displayName}`);
  console.log(`   Screens discovered: ${screensDiscovered}`);
  console.log(`   Flows generated: ${flowsGenerated}`);
  console.log(`   Coverage: ${summary.coveragePercent}% (target: ${summary.target}%)`);
  console.log(`   Target met: ${summary.targetMet ? '✓' : '✗'}\n`);
}

main().catch((err) => {
  console.error('Exploration failed:', err);
  process.exit(1);
});
