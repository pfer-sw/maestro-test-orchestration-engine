#!/usr/bin/env node
/**
 * PreToolUse guard — enforces the CLAUDE.md non-negotiables that are cheap to check and expensive to get wrong.
 * Wired in .claude/settings.json for Bash, Write, Edit and mcp__maestro__run. Reads the hook JSON on stdin and
 * prints a permission decision: "deny" (blocked, the reason goes back to Claude) or "ask" (the tester confirms).
 * Silent when nothing matches. Never throws: a broken guard must not block work.
 *
 *   deny  reading or writing .env / .env.example                   (non-negotiable 10)
 *   deny  a flow written with id: "~…" or point: without a comment (non-negotiable 1)
 *   ask   a flow run that contains a clearState command            (non-negotiable 3 — safe only if the app notes say so)
 *   ask   editing an existing report under reports/                (non-negotiable 9 — delivered reports get _vN)
 *   ask   replacing the testability register wholesale             (non-negotiable 9 — append only)
 *   ask   any git push                                             (pushes happen when the tester asks)
 *
 * Unit slot: tighten or loosen here — e.g. turn the clearState "ask" into "deny" when it wipes your dev endpoint,
 * or let one push target through without asking.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const decide = (permissionDecision, permissionDecisionReason) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason } }));
  process.exit(0);
};
const rel = (p) => path.relative(ROOT, path.resolve(ROOT, p));

// A clearState command, not a comment that mentions it.
const hasClearState = (yaml) => yaml.split('\n').some((line) => {
  const code = line.split('#')[0];
  return /^\s*-\s*clearState\b/.test(code) || /clearState:\s*true/.test(code) || /^\s*-\s*clearKeychain\b/.test(code);
});
const CLEAR_STATE = 'this flow has a clearState command — it can wipe a configured dev endpoint (non-negotiable 3). Approve only if the unit\'s app notes say clearState is safe on this build.';
const ENV_FILE = /(^|[\s/"'=<(])\.env(\.example|\.local)?(?=$|[\s"';|&)>])/;

function checkFlowText(text, where) {
  if (/\bid:\s*["']~/.test(text)) decide('deny', `${where}: Maestro has no "~" accessibility-id prefix — id: "~…" never matches (non-negotiable 1). Inspect the screen and use the real resource-id.`);
  if (/^\s*point:/m.test(text) && !/#\s*COORDINATES:/.test(text)) {
    decide('deny', `${where}: point: is the last resort (non-negotiable 1). Add "# COORDINATES: <element> has no locator — register: <screen>" on the step, use percentages, and add the register row.`);
  }
}

function bash(fullCommand) {
  // Heredoc bodies are text being written, not commands: a note that mentions the env file is not a read of it.
  const command = fullCommand.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$)/g, '<<heredoc');
  if (ENV_FILE.test(command)) decide('deny', 'Claude does not read or write .env / .env.example (non-negotiable 10). Scripts load their own keys; ask the tester for anything else.');

  const push = command.match(/\bgit\s+(?:-C\s+\S+\s+)?push\b[^;&|\n]*/);
  if (push) decide('ask', `"${push[0].trim()}" — pushes happen only when the tester asks.`);

  if (/\bmaestro\b/.test(command) && /\btest\b/.test(command)) {
    if (hasClearState(command)) decide('ask', CLEAR_STATE);
    for (const file of command.match(/[^\s"']+\.ya?ml/g) ?? []) {
      const full = path.resolve(ROOT, file);
      if (fs.existsSync(full) && hasClearState(fs.readFileSync(full, 'utf8'))) decide('ask', `${rel(full)}: ${CLEAR_STATE}`);
    }
  }
}

function write(tool, input) {
  const file = rel(input.file_path ?? '');
  const text = input.content ?? input.new_string ?? '';
  const exists = fs.existsSync(path.resolve(ROOT, file));

  if (/(^|\/)\.env(\.|$)/.test(file)) decide('deny', 'Claude does not write .env / .env.example (non-negotiable 10). Give the tester the paste-ready KEY=value list instead.');
  if (/\.ya?ml$/.test(file) && file.startsWith('flows/')) {
    checkFlowText(text, file);
    if (hasClearState(text)) decide('ask', `${file}: ${CLEAR_STATE}`);
  }
  if (exists && file.startsWith('reports/') && !file.startsWith('reports/_template/') && /\.html$/.test(file)) {
    decide('ask', `${file} already exists. A delivered report is never edited — a revision is a new file (_v2, _v3…). Approve only if this report has not been handed over yet.`);
  }
  if (tool === 'Write' && exists && file === 'docs/testability/missing-resource-ids.md') {
    decide('ask', 'The testability register is append-only (non-negotiable 9). Use Edit to add or move rows instead of rewriting the file.');
  }
}

function maestroRun(input) {
  if (input.yaml && hasClearState(input.yaml)) decide('ask', CLEAR_STATE);
  for (const file of input.files ?? []) {
    const full = path.resolve(ROOT, file);
    if (fs.existsSync(full) && hasClearState(fs.readFileSync(full, 'utf8'))) decide('ask', `${rel(full)}: ${CLEAR_STATE}`);
  }
}

let raw = '';
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const { tool_name: tool, tool_input: input = {} } = JSON.parse(raw || '{}');
    if (tool === 'Bash') bash(String(input.command ?? ''));
    else if (tool === 'Write' || tool === 'Edit') write(tool, input);
    else if (tool === 'mcp__maestro__run') maestroRun(input);
  } catch { /* fall through: no decision */ }
  process.exit(0);
});
