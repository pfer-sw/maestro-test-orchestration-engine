#!/usr/bin/env node
/**
 * fetch-wiki-page.js — pull a page from a wiki Pages REST API as Markdown.
 *
 * Endpoints used (relative to the wiki origin):
 *   - With WIKI_API_KEY in .env: GET /api/pages/:id?format=markdown
 *     (header `Authorization: Api-Key <key>`) — any page the key can read, private ones included.
 *   - Without it: POST /api/shares/page-info { pageId } — only pages published through a
 *     share link (unauthenticated); the body is ProseMirror JSON, converted to Markdown below.
 * Accepts a page URL (…/p/<slug>-<slugId>), a slugId or a page UUID. A full URL sets the
 * origin; for a bare id the origin comes from WIKI_BASE_URL (e.g. https://wiki.example.com).
 *
 * Usage:
 *   node scripts/fetch-wiki-page.js <wiki-url|id> [--out=kb/wiki/<file>.md]
 *
 * Output starts with a provenance header (source URL, page updatedAt, fetch date) so the
 * kb file records where and when it came from.
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2));
const url = args._[0];
if (!url) {
  console.error('Usage: node scripts/fetch-wiki-page.js <wiki-url> [--out=path.md]');
  process.exit(1);
}

const isUrl = /^https?:\/\//.test(url);
const baseUrl = process.env.WIKI_BASE_URL;
if (!isUrl && !baseUrl) {
  console.error('WIKI_BASE_URL is not set — set it in .env (e.g. https://wiki.example.com) or pass a full page URL.');
  process.exit(1);
}
const origin = isUrl ? new URL(url).origin : new URL(baseUrl).origin;
const pageId = isUrl ? new URL(url).pathname.split('/').pop().split('-').pop() : url;
const apiKey = process.env.WIKI_API_KEY;

let page;
if (apiKey) {
  const res = await fetch(`${origin}/api/pages/${pageId}?format=markdown`, {
    headers: { Authorization: `Api-Key ${apiKey}` },
  });
  if (!res.ok) {
    console.error(`Wiki API returned ${res.status} — 401 bad/deleted key, 403 page outside the key's spaces, 404 not found.`);
    process.exit(1);
  }
  page = (await res.json()).data;
} else {
  const res = await fetch(`${origin}/api/shares/page-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageId }),
  });
  if (!res.ok) {
    console.error(`Wiki returned ${res.status} — page is probably not shared publicly. Set WIKI_API_KEY.`);
    process.exit(1);
  }
  page = (await res.json()).data.page;
}

// ── ProseMirror JSON → Markdown ──────────────────────────────────────────────
function inline(nodes = []) {
  return nodes.map((n) => {
    if (n.type === 'hardBreak') return '  \n';
    if (n.type === 'mention') return `@${n.attrs?.label ?? ''}`;
    if (n.type !== 'text') return inline(n.content);
    let t = n.text;
    for (const m of n.marks ?? []) {
      if (m.type === 'code') t = `\`${t}\``;
      else if (m.type === 'bold') t = `**${t}**`;
      else if (m.type === 'italic') t = `*${t}*`;
      else if (m.type === 'link') t = `[${t}](${m.attrs?.href})`;
    }
    return t;
  }).join('');
}

function block(n, indent = '') {
  const kids = n.content ?? [];
  switch (n.type) {
    case 'doc': return kids.map((c) => block(c)).join('\n\n');
    case 'heading': return `${'#'.repeat(n.attrs?.level ?? 2)} ${inline(kids)}`;
    case 'paragraph': return indent + inline(kids);
    case 'bulletList':
    case 'orderedList':
      return kids.map((li, i) => {
        const marker = n.type === 'orderedList' ? `${i + 1}.` : '-';
        const [first, ...rest] = li.content ?? [];
        const head = first?.type === 'paragraph' ? inline(first.content) : block(first ?? {}, '');
        const tail = rest.map((c) => block(c, indent + '  ')).filter(Boolean).join('\n');
        return `${indent}${marker} ${head}${tail ? '\n' + tail : ''}`;
      }).join('\n');
    case 'codeBlock': return '```' + (n.attrs?.language ?? '') + '\n' + inline(kids) + '\n```';
    case 'blockquote':
    case 'callout':
      return kids.map((c) => block(c)).join('\n').split('\n').map((l) => `> ${l}`).join('\n');
    case 'details': return kids.map((c) => block(c, indent)).join('\n');
    case 'detailsSummary': { const t = inline(kids); return t.startsWith('**') ? t : `**${t}**`; }
    case 'detailsContent': return kids.map((c) => block(c, indent)).join('\n');
    case 'table': {
      const rows = kids.map((r) => (r.content ?? []).map((c) =>
        (c.content ?? []).map((p) => inline(p.content)).join(' ').replace(/\|/g, '\\|')));
      if (!rows.length) return '';
      const sep = rows[0].map(() => '---');
      return [rows[0], sep, ...rows.slice(1)].map((r) => `| ${r.join(' | ')} |`).join('\n');
    }
    case 'horizontalRule': return '---';
    case 'image': return `![${n.attrs?.alt ?? ''}](${n.attrs?.src ?? ''})`;
    default: return kids.length ? kids.map((c) => block(c, indent)).join('\n') : '';
  }
}

const md = [
  `<!-- source: ${url} | wiki updatedAt: ${page.updatedAt} | fetched: ${new Date().toISOString()} -->`,
  `# ${page.icon ? page.icon + ' ' : ''}${page.title}`,
  typeof page.content === 'string' ? page.content.trim() : block(page.content),
].join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n';

if (args.out) {
  writeFileSync(args.out, md);
  console.log(`✓ ${page.title} → ${args.out} (wiki updatedAt ${page.updatedAt})`);
} else {
  process.stdout.write(md);
}
