/**
 * jira-client.js
 * Abstraction over the mcp__claude_ai_Atlassian__ MCP tools.
 *
 * When Claude runs this framework it calls these functions, which in turn
 * describe the Atlassian MCP tool calls Claude should make.
 *
 * For script-driven mode (node scripts/export-jira.js), this uses the
 * Jira REST API directly with the credentials from config/global.json + .env.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

function loadGlobal() {
  return JSON.parse(readFileSync(resolve(ROOT, 'config', 'global.json'), 'utf8'));
}

function expandEnvInConfig(config) {
  return JSON.parse(
    JSON.stringify(config).replace(/\$\{([^}]+)\}/g, (_, v) => process.env[v] ?? '')
  );
}

/**
 * Get resolved Jira config with env vars expanded.
 */
export function getJiraConfig() {
  const global = loadGlobal();
  return expandEnvInConfig(global.jira);
}

/**
 * Build the Jira base URL for REST API calls.
 */
function apiUrl(jiraConfig, path) {
  return `${jiraConfig.baseUrl}/rest/api/3${path}`;
}

/**
 * Make a Jira REST API call.
 * In Claude's context, Claude calls mcp__claude_ai_Atlassian__jiraWrite / jiraRead tools.
 * In script mode, this uses fetch() with basic auth.
 */
async function jiraRequest(method, path, body, jiraConfig) {
  const cfg = jiraConfig ?? getJiraConfig();
  const auth = Buffer.from(`${cfg.userEmail}:${cfg.apiToken}`).toString('base64');
  const res = await fetch(apiUrl(cfg, path), {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API ${method} ${path} → ${res.status}: ${text}`);
  }
  return method === 'DELETE' ? null : res.json();
}

/**
 * Find or create the coverage dashboard issue.
 * When running via Claude MCP: use mcp__claude_ai_Atlassian__getJiraIssue
 */
export async function findOrCreateDashboardIssue(cfg) {
  cfg = cfg ?? getJiraConfig();
  if (cfg.coverageDashboardIssueKey) {
    try {
      const issue = await jiraRequest('GET', `/issue/${cfg.coverageDashboardIssueKey}`, null, cfg);
      return issue.key;
    } catch {
      // Falls through to create
    }
  }
  const issue = await jiraRequest('POST', '/issue', {
    fields: {
      project: { key: cfg.projectKey },
      summary: '[Maestro MCP] Test Coverage Dashboard',
      description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Automated test coverage dashboard. Updated by Maestro MCP Testing framework.' }] }] },
      issuetype: { name: 'Task' },
      labels: cfg.labels,
    },
  }, cfg);
  return issue.key;
}

/**
 * Update the dashboard issue description with the coverage report markdown.
 * When running via Claude MCP: use mcp__claude_ai_Atlassian__editJiraIssue
 */
export async function updateDashboardIssue(issueKey, markdownContent, cfg) {
  cfg = cfg ?? getJiraConfig();
  // Convert markdown table to Jira ADF
  await jiraRequest('PUT', `/issue/${issueKey}`, {
    fields: {
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'markdown' },
            content: [{ type: 'text', text: markdownContent }],
          },
        ],
      },
    },
  }, cfg);
}

/**
 * Add a comment to a Jira issue.
 * When running via Claude MCP: use mcp__claude_ai_Atlassian__addCommentToJiraIssue
 */
export async function addComment(issueKey, body, cfg) {
  cfg = cfg ?? getJiraConfig();
  await jiraRequest('POST', `/issue/${issueKey}/comment`, {
    body: {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
    },
  }, cfg);
}

/**
 * Search for an existing open bug for a specific flow.
 * When running via Claude MCP: use mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql
 */
export async function findExistingFlowBug(flowId, flavorId, cfg) {
  cfg = cfg ?? getJiraConfig();
  const label = `maestro-flow:${flowId}`;
  const jql = `project = "${cfg.projectKey}" AND labels = "${label}" AND labels = "${flavorId}" AND statusCategory != Done ORDER BY created DESC`;
  const results = await jiraRequest('GET', `/search?jql=${encodeURIComponent(jql)}&maxResults=1`, null, cfg);
  return results.issues?.[0] ?? null;
}

/**
 * Create a bug issue for a failing flow.
 * When running via Claude MCP: use mcp__claude_ai_Atlassian__createJiraIssue
 */
export async function createFlowBug({ flowId, flowName, flavorId, error, flowYaml, screenshotPath }, cfg) {
  cfg = cfg ?? getJiraConfig();
  const labels = [...cfg.labels, `maestro-flow:${flowId}`, flavorId];
  const description = [
    `*Automated test failure detected by Maestro MCP Testing Framework*`,
    ``,
    `*Flavor:* ${flavorId}`,
    `*Flow ID:* \`${flowId}\``,
    `*Flow File:* \`${flowYaml ? '(see below)' : 'N/A'}\``,
    ``,
    `*Error:*`,
    `{code}`,
    error ?? 'Unknown error',
    `{code}`,
    ``,
    flowYaml ? `*Flow Content:*\n{code:yaml}\n${flowYaml}\n{code}` : '',
    screenshotPath ? `*Screenshot:* ${screenshotPath}` : '',
  ].join('\n');

  const issue = await jiraRequest('POST', '/issue', {
    fields: {
      project: { key: cfg.projectKey },
      summary: `[Automated] Flow failing: ${flowName} (${flavorId})`,
      description: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }],
      },
      issuetype: { name: cfg.bugIssueType ?? 'Bug' },
      labels,
    },
  }, cfg);
  return issue.key;
}

/**
 * Create a security bug for an adversarial AI test failure.
 * When running via Claude MCP: use mcp__claude_ai_Atlassian__createJiraIssue
 */
export async function createSecurityBug({ flowId, prompt, observedAction, screenshotPath }, cfg) {
  cfg = cfg ?? getJiraConfig();
  const labels = [...cfg.labels, `maestro-flow:${flowId}`, 'ai', 'security', 'ai-safety'];
  const description = `*SECURITY: AI adversarial test failure*\n\nPrompt: "${prompt}"\nObserved action: ${observedAction}\nScreenshot: ${screenshotPath ?? 'N/A'}`;

  const issue = await jiraRequest('POST', '/issue', {
    fields: {
      project: { key: cfg.projectKey },
      summary: `[SECURITY] AI adversarial prompt executed unintended action (${flowId})`,
      description: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }],
      },
      issuetype: { name: cfg.bugIssueType ?? 'Bug' },
      labels,
      priority: { name: 'Critical' },
    },
  }, cfg);
  return issue.key;
}
