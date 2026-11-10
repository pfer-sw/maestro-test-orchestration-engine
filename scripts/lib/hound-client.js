/**
 * hound-client.js — Gyro's Hound test management (test cases, ticket results, evidence).
 *
 * Config (.env): HOUND_BASE_URL (your Gyro host) and HOUND_API_KEY — a personal key (acts as the
 * tester) or a project service-account key; GYRO_API_KEY is accepted as a fallback.
 * Contract: <HOUND_BASE_URL>/api/openapi.json (paths under /api/hound).
 */
import 'dotenv/config';

const BASE = process.env.HOUND_BASE_URL;
// Gyro's WAF rejects default library user agents.
const USER_AGENT = 'maestro-test-engine-hound';

function apiKey() {
  const key = process.env.HOUND_API_KEY || process.env.GYRO_API_KEY;
  if (!BASE) throw new Error('No HOUND_BASE_URL in .env');
  if (!key) throw new Error('No HOUND_API_KEY (or GYRO_API_KEY) in .env');
  return key;
}

export class HoundError extends Error {
  constructor(method, path, status, message) {
    super(`${method} ${path} → ${status}: ${message}`);
    this.status = status;
  }
}

async function request(method, path, { json, body, contentType } = {}) {
  const headers = { 'X-API-Key': apiKey(), 'User-Agent': USER_AGENT, Accept: 'application/json' };
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  if (contentType) headers['Content-Type'] = contentType;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : body,
  });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { message: text }; } })() : {};
  if (!res.ok) throw new HoundError(method, path, res.status, data.message ?? text.slice(0, 300));
  return data;
}

/** A Gyro ticket by key (e.g. PRJ-123) → { id, key, title, … }. */
export async function getTicket(key) {
  const data = await request('GET', `/api/requests/key/${encodeURIComponent(key)}`);
  return data.request ?? data;
}

export async function listPersonas(project) {
  return (await request('GET', `/api/hound/projects/${project}/personas`)).personas;
}

export async function getTestCase(project, key) {
  return (await request('GET', `/api/hound/projects/${project}/test-cases/${key}`)).testCase;
}

/** definition: { title, description?, preconditions?, steps[], platforms[], personaId, personaParams?, folderPath? } */
export async function createTestCase(project, definition) {
  const data = await request('POST', `/api/hound/projects/${project}/test-cases`, { json: definition });
  return data.testCase ?? data;
}

/**
 * Report results on a ticket in one call; cases are attached when missing.
 * results: [{ testCase, platform, status, execution?, notes?, clearEvidence? }]
 * The endpoint documents a `csp_` key; with a personal key it can refuse (403), in which case
 * each result is recorded through the per-case run endpoint instead.
 */
export async function reportResults(ticketId, results) {
  try {
    return await request('POST', `/api/hound/requests/${ticketId}/results`, { json: { results } });
  } catch (err) {
    if (!(err instanceof HoundError) || err.status !== 403) throw err;
    for (const r of results) {
      await request('PUT', `/api/hound/requests/${ticketId}/test-cases/${r.testCase}/runs/${r.platform}`, {
        json: { status: r.status, execution: r.execution ?? 'automated', notes: r.notes ?? null },
      });
    }
    return { fallback: 'per-case runs' };
  }
}

/** Upload one image/video as evidence on a ticket's case slot. buffer: file contents. */
export async function uploadEvidence(ticketId, testCase, platform, { fileName, contentType, buffer }) {
  const qs = new URLSearchParams({ platform, fileName, contentType });
  return request('POST', `/api/hound/requests/${ticketId}/test-cases/${testCase}/evidence?${qs}`, {
    body: buffer.toString('base64'),
    contentType: 'application/octet-stream',
  });
}

/** A ticket's attached cases with per-platform runs and evidence. */
export const ticketUrl = (key) => `${BASE}/requests/${key}`;

export async function getTicketHound(ticketId) {
  return request('GET', `/api/hound/requests/${ticketId}`);
}
