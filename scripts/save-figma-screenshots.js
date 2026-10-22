#!/usr/bin/env node
/**
 * save-figma-screenshots.js
 *
 * Downloads Figma frame screenshots via the Figma REST API and saves them to
 * screenshots/design-audit/figma/<date>/ so the HTML report can reference them.
 *
 * Must be run BEFORE the design audit comparison step.
 *
 * Usage:
 *   node scripts/save-figma-screenshots.js --figma-url=<url> [--date=YYYY-MM-DD]
 *   node scripts/save-figma-screenshots.js --figma-url=<url> --mapping=config/figma-mapping-cv.json --label=cv
 *     (--mapping picks another mapping file; --label writes to figma/<date>/<label>/)
 *
 * Required env var:
 *   FIGMA_TOKEN — Figma personal access token (Settings → Account → Personal access tokens)
 *
 * How it works:
 *   1. Parses fileKey from the provided Figma URL
 *   2. Reads all node IDs from config/figma-mapping.json
 *   3. Calls the Figma images export API to get download URLs for each node
 *   4. Downloads each PNG to screenshots/design-audit/figma/<date>/<nodeId>_figma.png
 *   5. Writes screenshots/design-audit/figma/<date>/_manifest.json
 *      mapping { nodeId → localPath } for use by CLAUDE.md comparison step
 *
 * Output:
 *   screenshots/design-audit/figma/<date>/<nodeId_colons_to_underscores>_figma.png
 *   screenshots/design-audit/figma/<date>/_manifest.json
 *
 * ⚠ ANIMATION FRAMES — choosing the right node ID:
 *   Figma files often contain multiple frames per screen representing animation keyframes
 *   (e.g. idle → typing → final state). The node IDs in config/figma-mapping.json MUST
 *   point to the FINAL animation frame — the state the user sees when the screen settles.
 *   Using an early/idle frame produces false positives in comparisons.
 *
 *   To discover all frames for a section and find the correct final-state node:
 *     curl -H "X-Figma-Token: $FIGMA_TOKEN" \
 *       "https://api.figma.com/v1/files/<fileKey>/nodes?ids=<sectionNodeId>" | \
 *       node -e "
 *         const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
 *         const s=d.nodes['<sectionNodeId>']?.document;
 *         (s?.children||[])
 *           .filter(c=>c.type==='FRAME')
 *           .sort((a,b)=>(a.absoluteBoundingBox?.x??0)-(b.absoluteBoundingBox?.x??0))
 *           .forEach(c=>console.log(c.id+' | x='+c.absoluteBoundingBox?.x+' | '+c.name));
 *       "
 *   Frames are ordered left-to-right on the canvas. The rightmost frame in each step's
 *   sequence is the final animation state — use that node ID in figma-mapping.json.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import minimist from 'minimist';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── Args ─────────────────────────────────────────────────────────────────────
const args = minimist(process.argv.slice(2));
const figmaUrl = args['figma-url'];
const dateArg = args.date ?? new Date().toISOString().slice(0, 10);
// Optional: alternate mapping file (e.g. config/figma-mapping-cv.json) and an output
// sub-folder label so several Figma sources can be downloaded on the same date.
const mappingArg = args.mapping ?? 'config/figma-mapping.json';
const labelArg = args.label ?? null;

if (!figmaUrl) {
  console.error('Usage: node scripts/save-figma-screenshots.js --figma-url=<figma-url> [--date=YYYY-MM-DD] [--mapping=config/<file>.json] [--label=<subdir>]');
  process.exit(1);
}

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
if (!FIGMA_TOKEN) {
  console.error('Error: FIGMA_TOKEN environment variable is not set.');
  console.error('Add FIGMA_TOKEN=<your-token> to your .env file.');
  console.error('Get a token at: https://www.figma.com/settings → Account → Personal access tokens');
  process.exit(1);
}

// ─── Parse Figma URL ──────────────────────────────────────────────────────────
// Handles:  https://www.figma.com/design/:fileKey/:name?node-id=X-Y
//           https://www.figma.com/design/:fileKey/branch/:branchKey/:name
const urlMatch = figmaUrl.match(/figma\.com\/design\/([^/?\s]+)/);
if (!urlMatch) {
  console.error(`Could not parse fileKey from Figma URL: ${figmaUrl}`);
  process.exit(1);
}
const fileKey = urlMatch[1];
console.log(`Figma file key: ${fileKey}`);

// ─── Load figma-mapping.json ──────────────────────────────────────────────────
const mappingPath = path.resolve(ROOT, mappingArg);
if (!fs.existsSync(mappingPath)) {
  console.error(`${mappingArg} not found. Add node ID mappings before running.`);
  process.exit(1);
}

const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const screens = mapping.screens ?? {};

// Collect non-example node IDs (skip keys prefixed with "_example")
const nodeEntries = Object.entries(screens).filter(([k]) => !k.startsWith('_example'));
if (nodeEntries.length === 0) {
  console.error(`No screen entries found in ${mappingArg} (all entries start with _example).`);
  console.error('Add real flow ID entries with figmaNodeId values before running.');
  process.exit(1);
}

const nodeIds = nodeEntries.map(([, v]) => v.figmaNodeId);
console.log(`Exporting ${nodeIds.length} Figma frames: ${nodeIds.join(', ')}`);

// ─── Output directory ─────────────────────────────────────────────────────────
const outDir = path.resolve(ROOT, 'screenshots', 'design-audit', 'figma', dateArg, ...(labelArg ? [labelArg] : []));
fs.mkdirSync(outDir, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nodeIdToFilename(nodeId) {
  // "13016:4245" → "13016_4245_figma.png"
  return `${nodeId.replace(/:/g, '_')}_figma.png`;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        httpsGet(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
  });
}

function figmaApiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.figma.com',
      path: endpoint,
      method: 'GET',
      headers: { 'X-Figma-Token': FIGMA_TOKEN },
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          if (res.statusCode !== 200) {
            reject(new Error(`Figma API ${res.statusCode}: ${body.message ?? JSON.stringify(body)}`));
          } else {
            resolve(body);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Figma API response: ${e.message}`));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Figma images API accepts comma-separated node IDs
  // IDs in the URL must use URL-encoding for colons: "13016:4245" → "13016%3A4245"
  // Large mappings are requested in batches — one render call for 200+ frames times out.
  const BATCH_SIZE = 40;
  const imageUrls = {};
  for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
    const batch = nodeIds.slice(i, i + BATCH_SIZE);
    const encodedIds = batch.map((id) => encodeURIComponent(id)).join(',');
    const apiPath = `/v1/images/${fileKey}?ids=${encodedIds}&format=png&scale=2`;

    console.log(`Requesting export URLs from Figma API… (${i + 1}–${i + batch.length} of ${nodeIds.length})`);
    let imageData;
    // Retry on 429 (rate limit) with exponential backoff — large mappings and prior
    // tree fetches easily hit Figma's per-minute render quota.
    for (let attempt = 1; ; attempt++) {
      try {
        imageData = await figmaApiGet(apiPath);
        break;
      } catch (err) {
        const waitS = Math.min(120, 15 * 2 ** (attempt - 1));
        if (/Figma API 429/.test(err.message) && attempt <= 5) {
          console.warn(`  ⚠ rate limited — retrying in ${waitS}s (attempt ${attempt}/5)`);
          await new Promise((r) => setTimeout(r, waitS * 1000));
          continue;
        }
        console.error(`Figma API request failed: ${err.message}`);
        process.exit(1);
      }
    }

    if (imageData.err) {
      console.error(`Figma API returned an error: ${imageData.err}`);
      process.exit(1);
    }

    Object.assign(imageUrls, imageData.images ?? {});
  }

  const manifest = {}; // nodeId → local file path
  let downloaded = 0;
  let failed = 0;

  for (const [flowId, entry] of nodeEntries) {
    const nodeId = entry.figmaNodeId;
    const downloadUrl = imageUrls[nodeId];

    if (!downloadUrl) {
      console.warn(`  ⚠ No export URL returned for node ${nodeId} (${flowId}) — skipping`);
      failed++;
      continue;
    }

    const filename = nodeIdToFilename(nodeId);
    const localPath = path.join(outDir, filename);

    process.stdout.write(`  Downloading ${nodeId} (${entry.figmaFrameName ?? flowId})… `);
    try {
      const imgBuffer = await httpsGet(downloadUrl);
      fs.writeFileSync(localPath, imgBuffer);
      const relativePath = path.relative(ROOT, localPath);
      manifest[nodeId] = relativePath;
      console.log(`✓ saved to ${relativePath}`);
      downloaded++;
    } catch (err) {
      console.log(`✗ failed: ${err.message}`);
      failed++;
    }
  }

  // Write manifest: nodeId → relative path from ROOT
  const manifestPath = path.join(outDir, '_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nManifest written to: ${path.relative(ROOT, manifestPath)}`);
  console.log(`Done: ${downloaded} downloaded, ${failed} failed.`);

  if (failed > 0 && downloaded === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('save-figma-screenshots failed:', err);
  process.exit(1);
});
