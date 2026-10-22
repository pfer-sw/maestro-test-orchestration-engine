/**
 * flow-generator.js
 * Utilities for generating and persisting Maestro YAML flow files.
 * The actual content generation is done by Claude; this module handles
 * file naming, path resolution, and YAML structure helpers.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

/** Generate a safe filename from a flow ID or description. */
export function flowIdToFilename(id) {
  return id.replace(/\./g, '_').replace(/[^a-z0-9_-]/gi, '_').toLowerCase() + '.yaml';
}

/** Resolve the path for a generated flow. */
export function generatedFlowPath(flavorId, date, filename) {
  const dateStr = date ?? new Date().toISOString().slice(0, 10);
  return resolve(ROOT, 'flows', 'generated', flavorId, dateStr, filename);
}

/** Save a flow YAML string to the appropriate path. */
export function saveGeneratedFlow(flavorId, flowId, yamlContent) {
  const filename = flowIdToFilename(flowId);
  const filePath = generatedFlowPath(flavorId, null, filename);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, yamlContent, 'utf8');
  return filePath;
}

/** Save a healed version of a flow (versioned). */
export function saveHealedFlow(originalPath, yamlContent, attempt) {
  const dir = dirname(originalPath);
  const base = originalPath.replace(/\.yaml$/, '');
  const healedPath = `${base}_healed_${attempt}.yaml`;
  writeFileSync(healedPath, yamlContent, 'utf8');
  return healedPath;
}

/** Build the minimal valid Maestro YAML header for a flow. */
export function buildFlowHeader(appId, flowName) {
  return `appId: ${appId}\nname: "${flowName}"\n---\n`;
}

/**
 * Build a Maestro YAML flow for an AI meta-test interaction.
 * Claude fills in the actual prompt; this generates the structural boilerplate.
 */
export function buildAiInteractionFlow({ appId, flowName, promptText, selectors, timeoutMs }) {
  return `appId: ${appId}
name: "${flowName}"
---
- launchApp
- tapOn:
    id: "${selectors.promptInput}"
- clearText
- inputText: "${promptText}"
- tapOn:
    id: "${selectors.submitButton}"
- waitForAnimationToEnd:
    timeout: ${Math.round(timeoutMs / 2)}
- takeScreenshot: "${flowName.replace(/\s+/g, '_').toLowerCase()}_response"
- assertVisible:
    id: "${selectors.responseArea}"
`;
}

/** Templates for screen-analysis prompt injection. */
export function buildScreenAnalysisPrompt(template, vars) {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

/** Templates for flow-generation prompt injection. */
export function buildFlowGenerationPrompt(template, vars) {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, typeof v === 'object' ? JSON.stringify(v, null, 2) : v);
  }
  return out;
}

/** Templates for heal-flow prompt injection. */
export function buildHealPrompt(template, vars) {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}
