/**
 * run-tests.js
 * Phase 2: Run flows, heal failures, fill coverage gaps.
 *
 * Usage:
 *   node scripts/run-tests.js --flavor=main
 *   node scripts/run-tests.js --flavor=main --group=baseline
 *   node scripts/run-tests.js --flavor=all --heal          # every flavor in config/flavors.json
 *   node scripts/run-tests.js --flavor=all --heal --group=baseline
 */

import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import minimist from 'minimist';

import {
  loadTaxonomy, saveTaxonomy, getExecutionPlan,
  updateFlowCoverage, recomputeSummary, writeCoverageSnapshot
} from './lib/coverage-tracker.js';
import { resolveDevice, connectDevice, runFlow, takeScreenshot, expandEnv } from './lib/maestro-client.js';
import { resolveFlowAccount, getEnvVars } from './lib/account-manager.js';
import { saveHealedFlow, buildHealPrompt } from './lib/flow-generator.js';
import { createSecurityBug } from './lib/jira-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = minimist(process.argv.slice(2));
const flavorArg = args.flavor ?? 'all';
const group = args.group ?? 'all';
const healEnabled = !!args.heal;
const compareFigmaUrl = typeof args['compare-figma'] === 'string' ? args['compare-figma'] : null;

const flavorsConfig = JSON.parse(readFileSync(resolve(ROOT, 'config', 'flavors.json'), 'utf8'));
const globalConfig = JSON.parse(readFileSync(resolve(ROOT, 'config', 'global.json'), 'utf8'));

const targetFlavors = flavorArg === 'all'
  ? Object.keys(flavorsConfig.flavors)
  : [flavorArg];

for (const f of targetFlavors) {
  if (!flavorsConfig.flavors[f]) {
    console.error(`Unknown flavor: ${f}`);
    process.exit(1);
  }
}

// ── AI Meta-Test Result Logger ────────────────────────────────────────────────

const aiResults = [];

function logAiResult(result) {
  aiResults.push(result);
  const logPath = resolve(ROOT, 'reports', 'coverage', `ai-meta-tests-${Date.now()}.json`);
  // Append to a session file
  writeFileSync(resolve(ROOT, 'reports', 'coverage', 'ai-meta-tests-latest.json'),
    JSON.stringify(aiResults, null, 2), 'utf8');
}

// ── Healing ───────────────────────────────────────────────────────────────────

async function healFlow(flow, flavorId, error, screenshotPath) {
  const flowPath = resolve(ROOT, flow.flowFile);
  if (!existsSync(flowPath)) {
    console.log(`   ✗ Cannot heal: flow file not found at ${flowPath}`);
    return null;
  }

  const flowYaml = readFileSync(flowPath, 'utf8');
  const templatePath = resolve(ROOT, 'prompts', 'exploration', 'heal-flow.md');
  const template = existsSync(templatePath) ? readFileSync(templatePath, 'utf8') : '';

  // Build heal prompt for Claude to analyze
  const healContext = {
    flowPath,
    flowYaml,
    errorOutput: error,
    screenshotPath: screenshotPath ?? 'N/A',
    packageName: flavorsConfig.flavors[flavorId].app.packageName,
  };

  console.log(`   🔧 Heal context prepared for flow: ${flow.id}`);
  console.log(`   📋 Error: ${error?.slice(0, 120)}`);

  // NOTE FOR CLAUDE: At this point, read the heal-flow.md template, inject the
  // context above, analyze the failing flow YAML + error + screenshot, and
  // generate a corrected YAML. Then call validateFlow() and runFlow() again.

  const maxAttempts = globalConfig.healing.maxHealAttempts ?? 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`   🔧 Healing attempt ${attempt}/${maxAttempts}`);
    // NOTE FOR CLAUDE: Generate corrected YAML here, validate, then try running

    // Placeholder: return null to indicate healing requires Claude's analysis
    break;
  }
  return null;
}

// ── AI Flow Evaluation ────────────────────────────────────────────────────────

/**
 * Run an AI meta-test flow with two-layer evaluation.
 * Layer 1: Maestro interaction (did the flow execute?)
 * Layer 2: Claude semantic evaluation (did the LLM behave correctly?)
 */
async function runAiMetaTest(flow, flavor, env) {
  const aiConfig = flavor.aiTesting;
  const metaTesting = flow.metaTesting;
  const minRuns = metaTesting?.minRuns ?? aiConfig?.minRunsPerTest ?? 2;
  const category = metaTesting?.category ?? 'unknown';
  const passThreshold = metaTesting?.passThreshold ?? 'any';
  const flowPath = resolve(ROOT, flow.flowFile);

  if (!existsSync(flowPath)) {
    console.log(`   ⚠ AI flow file not found: ${flowPath} — skipping`);
    return { flowId: flow.id, category, aggregateResult: 'skipped', runs: [] };
  }

  const runs = [];
  for (let i = 1; i <= minRuns; i++) {
    console.log(`   🤖 AI meta-test run ${i}/${minRuns}: ${flow.name}`);

    // Layer 1: Run the Maestro interaction flow
    const result = await runFlow(flowPath, env, resolve(ROOT, 'reports', 'raw'));
    const screenshotPath = resolve(ROOT, 'screenshots', 'failures', `ai_${flow.id}_run${i}_${Date.now()}.png`);
    await takeScreenshot(screenshotPath);

    let maestroResult = result.success ? 'pass' : 'fail';
    let semanticResult = 'pending';

    // Layer 2: Claude evaluates the screenshot semantically
    // NOTE FOR CLAUDE: Read the screenshot at screenshotPath.
    // Use prompts/ai-flavor/response-verification.md to evaluate:
    //   - Did the LLM take the expected action?
    //   - Is the response semantically appropriate for this test category?
    // Set semanticResult to: "pass" | "fail" | "security_failure" | "consistency_issue"

    console.log(`   Layer 1 (Maestro): ${maestroResult}`);
    console.log(`   Layer 2 (Semantic): [Awaiting Claude analysis of ${screenshotPath}]`);

    // Adversarial security check
    if (category === 'adversarial' && semanticResult === 'security_failure') {
      console.error(`   🚨 SECURITY FAILURE: Adversarial prompt executed unintended action!`);
      try {
        const issueKey = await createSecurityBug({
          flowId: flow.id,
          prompt: metaTesting?.promptTemplate ?? 'unknown',
          observedAction: 'see screenshot',
          screenshotPath,
        });
        console.error(`   🚨 Jira security bug created: ${issueKey}`);
      } catch (jiraErr) {
        console.error(`   ⚠ Could not create Jira security bug: ${jiraErr.message}`);
      }
    }

    runs.push({ runIndex: i, maestroResult, semanticResult, screenshotPath, durationMs: null });
  }

  // Aggregate results
  const semanticPasses = runs.filter((r) => r.semanticResult === 'pass').length;
  const semanticFails = runs.filter((r) => r.semanticResult === 'fail').length;
  const hasConsistencyIssue = runs.length > 1 &&
    new Set(runs.map((r) => r.semanticResult)).size > 1;

  let aggregateResult;
  if (passThreshold === 'any') {
    aggregateResult = semanticPasses > 0 ? 'pass' : 'fail';
  } else {
    aggregateResult = semanticFails === 0 ? 'pass' : 'fail';
  }

  const runResult = {
    flowId: flow.id,
    category,
    runs,
    aggregateResult,
    consistencyScore: semanticPasses / runs.length,
    consistencyIssue: hasConsistencyIssue,
  };

  if (hasConsistencyIssue) {
    console.log(`   ⚠ Consistency issue detected — LLM produced different actions across runs`);
  }

  logAiResult(runResult);
  return runResult;
}

// ── Main Test Runner ──────────────────────────────────────────────────────────

async function runForFlavor(flavorId, figmaUrl) {
  const flavor = flavorsConfig.flavors[flavorId];
  const baseEnv = expandEnv(flavor.env);
  const taxonomy = loadTaxonomy();

  console.log(`\n🧪 Running tests for: ${flavor.displayName}`);
  console.log(`   Group: ${group} | Heal: ${healEnabled ? 'on' : 'off'} | Design audit: ${figmaUrl ? 'on' : 'off'}`);

  // Connect to pre-connected adb device
  const device = await resolveDevice(flavor.device);
  await connectDevice(device.id);
  console.log(`   Device: ${device.id}`);

  // Build execution plan
  const plan = getExecutionPlan(taxonomy, flavorId, group);
  console.log(`   Flows to run: ${plan.length}\n`);

  let passed = 0, failed = 0, healed = 0, skipped = 0;
  let baselineFailed = false;

  for (const flow of plan) {
    const isBaseline = flow.tags?.includes('baseline');
    const isAiFlow = flow.tags?.includes('ai');
    const flowPath = resolve(ROOT, flow.flowFile ?? '');

    // aiTesting.enabled is the gate for ai-tagged flows
    if (isAiFlow && !flavor.aiTesting?.enabled) {
      console.log(`⏭ ${flow.id} — aiTesting not enabled for ${flavorId}`);
      skipped++;
      continue;
    }

    // Skip flows with no file
    if (!flow.flowFile || !existsSync(flowPath)) {
      console.log(`⏭ ${flow.id} — no flow file yet (${flow.coverage[flavorId]?.status})`);
      skipped++;
      continue;
    }

    process.stdout.write(`▶ ${flow.name} `);

    // Resolve account and merge credentials into env for this flow
    const account = resolveFlowAccount(flow, flavor);
    const env = { ...baseEnv, ...getEnvVars(account) };

    let result;
    const startedAt = Date.now();

    if (isAiFlow) {
      // AI meta-test: two-layer evaluation
      const aiResult = await runAiMetaTest(flow, flavor, env);
      result = { success: aiResult.aggregateResult === 'pass' };
    } else {
      result = await runFlow(flowPath, env, resolve(ROOT, 'reports', 'raw'));
    }
    const lastRunDurationMs = Date.now() - startedAt;

    if (result.success) {
      console.log(`✓`);
      passed++;
      updateFlowCoverage(taxonomy, flow.id, flavorId, {
        status: 'covered',
        lastResult: 'pass',
        lastRunDate: new Date().toISOString(),
        lastRunDurationMs,
      });

      // NOTE FOR CLAUDE (--compare-figma mode):
      // If figmaUrl is set, run the Figma design audit for this flow now:
      //   1. On first passing flow only: parse fileKey from figmaUrl, call
      //      mcp__claude_ai_Figma__get_metadata(fileKey) to enumerate frames, cache the list.
      //   2. Match flow.id / flow.name against cached frame names (check
      //      config/figma-mapping.json first for explicit overrides).
      //   3. If match found: call mcp__claude_ai_Figma__get_screenshot, save to
      //      screenshots/design-audit/figma/<YYYY-MM-DD>/<flowId>_figma.png
      //   4. Call mcp__maestro__take_screenshot, save to
      //      screenshots/design-audit/app/<YYYY-MM-DD>/<flowId>_app.png
      //   5. Fill and run prompts/design-audit/figma-screen-comparison.md.
      //   6. Write JSON result to reports/design-audit/<YYYY-MM-DD>/<flowId>.json.
      //   Full procedure: docs/design-audit.md (CLAUDE.md → Phase 2: Orchestrator, Step 3 → Pass).
      if (figmaUrl) {
        const today = new Date().toISOString().slice(0, 10);
        console.log(`   [design-audit] Figma comparison queued for ${flow.id} (${today})`);
      }
    } else {
      console.log(`✗`);
      failed++;

      // Capture failure screenshot
      const screenshotPath = resolve(ROOT, 'screenshots', 'failures',
        `${flavorId}_${flow.id.replace(/\./g, '_')}_${Date.now()}.png`);
      await takeScreenshot(screenshotPath);
      console.log(`   📸 Failure screenshot: ${screenshotPath}`);

      // Attempt healing if enabled
      let healedPath = null;
      if (healEnabled) {
        healedPath = await healFlow(flow, flavorId, result.error, screenshotPath);
      }

      if (healedPath) {
        healed++;
        // NOTE FOR CLAUDE: take a post-heal screenshot and save to screenshots/healed/<flavorId>_<flow.id>_<Date.now()>.png
        // to confirm what the screen looked like after the healed flow passed.
        updateFlowCoverage(taxonomy, flow.id, flavorId, {
          status: 'covered',
          lastResult: 'pass',
          lastRunDate: new Date().toISOString(),
          failureReason: null,
        });
      } else {
        updateFlowCoverage(taxonomy, flow.id, flavorId, {
          status: 'failing',
          lastResult: 'fail',
          lastRunDate: new Date().toISOString(),
          lastRunDurationMs,
          failureReason: result.error?.slice(0, 500),
        });
      }

      // STOP if baseline flow fails and cannot be healed
      if (isBaseline && !healedPath) {
        console.error(`\n🚨 CRITICAL: Baseline flow failed: ${flow.name}`);
        console.error(`   This indicates a fundamental app regression.`);
        console.error(`   Stopping test run. Fix baseline flows before proceeding.\n`);
        baselineFailed = true;
        break;
      }
    }

    // Save taxonomy after each flow
    recomputeSummary(taxonomy);
    saveTaxonomy(taxonomy);
  }

  // Print summary
  console.log(`\n── ${flavor.displayName} ──`);
  console.log(`   ✓ Passed: ${passed}`);
  console.log(`   ✗ Failed: ${failed}`);
  console.log(`   🔧 Healed: ${healed}`);
  console.log(`   ⏭ Skipped (no flow file / aiTesting off): ${skipped}`);

  recomputeSummary(taxonomy);
  saveTaxonomy(taxonomy);

  const summary = taxonomy.coverageSummary[flavorId];
  console.log(`   Coverage: ${summary.coveragePercent}% (target: ${summary.target}% ${summary.targetMet ? '✓' : '✗'})`);

  return { passed, failed, healed, skipped, baselineFailed };
}

async function main() {
  const results = {};

  for (const flavorId of targetFlavors) {
    results[flavorId] = await runForFlavor(flavorId, compareFigmaUrl);
    if (results[flavorId].baselineFailed) {
      console.error(`\nStopping: baseline failure in ${flavorId}`);
      break;
    }
  }

  // Print combined coverage table
  const taxonomy = loadTaxonomy();
  console.log('\n── Coverage Summary ──────────────────────────────────────────────────');
  for (const [flavorId, summary] of Object.entries(taxonomy.coverageSummary)) {
    if (!targetFlavors.includes(flavorId) && flavorArg !== 'all') continue;
    console.log(`${flavorId.padEnd(10)} ${summary.covered}/${summary.total} = ${summary.coveragePercent}% (target: ${summary.target}% ${summary.targetMet ? '✓' : '✗'})`);
  }
  console.log('');

  // Design audit report (Claude runs this in --compare-figma mode per CLAUDE.md Step 6)
  if (compareFigmaUrl) {
    const today = new Date().toISOString().slice(0, 10);
    const auditDir = resolve(ROOT, 'reports', 'design-audit', today);
    console.log('\n── Design Audit ──────────────────────────────────────────────────');
    console.log(`   Figma URL: ${compareFigmaUrl}`);
    console.log(`   Audit results directory: ${auditDir}`);
    console.log(`   NOTE FOR CLAUDE: Run the following to generate the HTML report:`);
    console.log(`   node scripts/generate-design-audit-report.js --date=${today} --flavor=${flavorArg}`);
  }

  const anyFailed = Object.values(results).some((r) => r.baselineFailed || r.failed > 0);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
