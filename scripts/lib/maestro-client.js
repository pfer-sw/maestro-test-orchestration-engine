/**
 * maestro-client.js
 * Thin wrapper around the maestro-mcp MCP tools.
 *
 * When Claude runs this framework, it calls these functions which in turn
 * invoke the maestro_* MCP tools. For script-driven runs (node scripts/*.js),
 * these functions call the maestro CLI directly via child_process.
 *
 * In Claude's context the actual tool invocations happen via the MCP server.
 * This file documents the expected interface so scripts can call it consistently.
 */

import { execSync, spawnSync } from 'child_process';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

/**
 * List connected Android devices/emulators.
 * Maps to: maestro_list_devices MCP tool
 */
export async function listDevices() {
  const result = spawnSync('maestro', ['--version'], { encoding: 'utf8' });
  if (result.error) {
    console.warn('[maestro-client] maestro CLI not found — running in mock mode');
    return [{ id: 'mock-emulator', name: 'Mock Emulator (no device connected)', platform: 'android' }];
  }
  // In real usage via MCP: Claude calls maestro_list_devices tool directly
  // For CLI mode: parse adb devices
  try {
    const adb = spawnSync('adb', ['devices', '-l'], { encoding: 'utf8' });
    const lines = adb.stdout.split('\n').slice(1).filter((l) => l.trim() && !l.includes('offline'));
    return lines.map((line) => {
      const [id, , ...rest] = line.trim().split(/\s+/);
      return { id, name: rest.join(' ') || id, platform: 'android' };
    });
  } catch {
    return [];
  }
}

/**
 * Pull the real failure out of Maestro CLI output. stderr is dominated by JVM
 * "WARNING: sun.misc.Unsafe…" noise; the actionable lines live in stdout.
 */
function extractMaestroError(err) {
  const lines = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('WARNING:'));
  const hit = lines.filter((l) => /FAILED|Assertion is false|Element not found|not installed|Error|Exception/.test(l));
  return (hit.length ? hit : lines).slice(0, 4).join(' | ') || err.message;
}

/**
 * Run a Maestro flow file.
 * Maps to: maestro_run_flow MCP tool
 * @param {string} flowPath - absolute path to YAML flow file
 * @param {object} env - env vars to pass to the flow
 * @param {string} reportDir - where to write JUnit output
 */
export async function runFlow(flowPath, env = {}, reportDir = null, deviceId = null) {
  ensureDir(reportDir ?? resolve(ROOT, 'reports', 'raw'));
  const deviceArg = deviceId ? `--device ${deviceId}` : '';
  const envArgs = Object.entries(env)
    .map(([k, v]) => `--env ${k}="${v}"`)
    .join(' ');
  const reportArgs = reportDir
    ? `--format junit --output "${resolve(reportDir, 'results.xml')}"`
    : '';
  const cmd = `maestro test ${deviceArg} ${envArgs} ${reportArgs} "${flowPath}"`.replace(/\s+/g, ' ').trim();
  try {
    const out = execSync(cmd, { encoding: 'utf8', cwd: ROOT });
    return { success: true, output: out };
  } catch (err) {
    return { success: false, output: err.stdout ?? '', error: extractMaestroError(err) };
  }
}

/**
 * Validate a Maestro flow file without running it.
 * Maps to: maestro_validate_flow MCP tool
 */
export async function validateFlow(flowPath) {
  try {
    const out = execSync(`maestro validate "${flowPath}"`, { encoding: 'utf8', cwd: ROOT });
    return { valid: true, output: out };
  } catch (err) {
    return { valid: false, output: err.stdout ?? '', error: err.stderr ?? err.message };
  }
}

/**
 * Take a screenshot of the current device state.
 * Maps to: maestro_screenshot MCP tool
 * @param {string} savePath - full path where screenshot should be saved
 */
export async function takeScreenshot(savePath, deviceId = null) {
  ensureDir(resolve(savePath, '..'));
  const deviceArg = deviceId ? `-s ${deviceId}` : '';
  try {
    execSync(`adb ${deviceArg} exec-out screencap -p > "${savePath}"`.trim(), { encoding: 'utf8', cwd: ROOT, shell: true });
    return { success: true, path: savePath };
  } catch (err) {
    console.warn(`[maestro-client] Screenshot failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Run multiple flows in sequence.
 * Maps to: maestro_run_flows MCP tool
 */
export async function runFlows(flowPaths, env = {}, reportDir = null) {
  const results = [];
  for (const fp of flowPaths) {
    const result = await runFlow(fp, env, reportDir);
    results.push({ flowPath: fp, ...result });
    if (!result.success) break; // stop on first failure (caller handles healing)
  }
  return results;
}

/**
 * Connect to a specific device (must already be connected via adb).
 * Maps to: maestro_connect_device MCP tool
 * @param {string} deviceId - adb device serial (from `adb devices`), or empty for first device
 */
export async function connectDevice(deviceId) {
  const target = deviceId ? `-s ${deviceId}` : '';
  try {
    execSync(`adb ${target} shell echo connected`, { encoding: 'utf8' });
    return { connected: true, deviceId };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/**
 * Resolve the device to use for a flavor.
 * Uses preferredDeviceId from flavor config, falls back to first connected device.
 */
export async function resolveDevice(flavorDeviceConfig) {
  const devices = await listDevices();
  if (devices.length === 0) {
    throw new Error('No ADB devices connected. Run `adb devices` to check.');
  }
  // flavors.json stores "${MAESTRO_DEVICE_ID}" — expand it; an unset var means "no preference".
  const preferred = (flavorDeviceConfig?.preferredDeviceId ?? '')
    .replace(/\$\{([^}]+)\}/g, (_, v) => process.env[v] ?? '');
  if (preferred) {
    const match = devices.find((d) => d.id === preferred);
    if (match) return match;
    console.warn(`[maestro-client] Device ${preferred} not found — using first available: ${devices[0].id}`);
  }
  return devices[0];
}

/**
 * Expand ${VAR} placeholders in an env config object using process.env.
 */
export function expandEnv(envConfig) {
  const expanded = {};
  for (const [key, value] of Object.entries(envConfig)) {
    expanded[key] = String(value).replace(/\$\{([^}]+)\}/g, (_, varName) => {
      return process.env[varName] ?? '';
    });
  }
  return expanded;
}
