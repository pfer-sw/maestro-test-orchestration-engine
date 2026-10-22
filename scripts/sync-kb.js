/**
 * sync-kb.js
 * Pulls knowledge base files from configured GitHub repositories
 * into the local kb/ directory.
 *
 * Usage:
 *   node scripts/sync-kb.js                  # sync all repos
 *   node scripts/sync-kb.js --repo=<id>      # sync one repo
 *   node scripts/sync-kb.js --dry-run        # print what would be fetched, write nothing
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = minimist(process.argv.slice(2));
const DRY_RUN = !!args['dry-run'];
const REPO_FILTER = args.repo ?? null;

function loadConfig() {
  const raw = readFileSync(resolve(ROOT, 'config', 'kb.json'), 'utf8');
  return JSON.parse(
    raw.replace(/\$\{([^}]+)\}/g, (_, v) => process.env[v] ?? '')
  );
}

function loadManifest() {
  const p = resolve(ROOT, 'kb', '_manifest.json');
  if (!existsSync(p)) return { lastSync: {}, fileCount: {} };
  return JSON.parse(readFileSync(p, 'utf8'));
}

function saveManifest(manifest) {
  if (DRY_RUN) return;
  const p = resolve(ROOT, 'kb', '_manifest.json');
  mkdirSync(resolve(ROOT, 'kb'), { recursive: true });
  writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n');
}

async function githubGet(url, token) {
  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${url}`);
  return res.json();
}

async function downloadText(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Download error ${res.status}: ${url}`);
  return res.text();
}

/**
 * Recursively fetches all files under a path in a GitHub repo.
 * Returns array of { path, downloadUrl }.
 */
async function listRepoFiles(apiBase, owner, repo, branch, repoPath, token) {
  const url = `${apiBase}/repos/${owner}/${repo}/contents/${repoPath}?ref=${branch}`;
  const entries = await githubGet(url, token);
  if (!Array.isArray(entries)) {
    // Single file
    return entries.type === 'file' ? [{ path: entries.path, downloadUrl: entries.download_url }] : [];
  }
  const files = [];
  for (const entry of entries) {
    if (entry.type === 'file') {
      files.push({ path: entry.path, downloadUrl: entry.download_url });
    } else if (entry.type === 'dir') {
      const nested = await listRepoFiles(apiBase, owner, repo, branch, entry.path, token);
      files.push(...nested);
    }
  }
  return files;
}

async function syncRepo(repoConfig, config, manifest) {
  // Authored sources have no upstream — syncing would overwrite hand-written content.
  if (repoConfig.authored) {
    console.log(`  SKIP ${repoConfig.id}: authored in this repo (${repoConfig.outputDir}) — edit in place, tracked in git`);
    return 0;
  }

  // Local-checkout repos are not synced — user manages them via git pull
  if (repoConfig.localPath) {
    console.log(`  SKIP ${repoConfig.id}: local checkout at ${repoConfig.localPath} — run \`git pull\` there to update`);
    return 0;
  }

  const token = process.env[config.tokenEnvVar];
  if (!token) {
    console.warn(`  WARNING: ${config.tokenEnvVar} not set — unauthenticated requests are rate-limited`);
  }

  const { id, owner, repo, branch, paths, outputDir } = repoConfig;
  const absOutputDir = resolve(ROOT, outputDir);

  if (!owner || owner.startsWith('<') || !repo || repo.startsWith('<')) {
    console.warn(`  SKIP ${id}: owner/repo not configured in config/kb.json`);
    return 0;
  }

  console.log(`  Fetching ${owner}/${repo}@${branch} → ${outputDir}`);

  let totalFiles = 0;
  for (const repoPath of paths) {
    const files = await listRepoFiles(config.githubApiBase, owner, repo, branch, repoPath.replace(/\/$/, ''), token);

    for (const file of files) {
      // Strip the configured path prefix to get a relative path within outputDir
      const prefix = repoPath.replace(/\/$/, '');
      const relFile = file.path.startsWith(prefix + '/')
        ? file.path.slice(prefix.length + 1)
        : file.path;

      const dest = join(absOutputDir, relFile);
      const destDir = dirname(dest);

      if (DRY_RUN) {
        console.log(`    [dry-run] would write: ${outputDir}/${relFile}`);
      } else {
        const content = await downloadText(file.downloadUrl, token);
        mkdirSync(destDir, { recursive: true });
        writeFileSync(dest, content);
        console.log(`    ✓ ${outputDir}/${relFile}`);
      }
      totalFiles++;
    }
  }

  if (!DRY_RUN) {
    manifest.lastSync[id] = new Date().toISOString();
    manifest.fileCount[id] = totalFiles;
  }

  return totalFiles;
}

async function main() {
  const config = loadConfig();
  const manifest = loadManifest();

  const repos = REPO_FILTER
    ? config.repositories.filter(r => r.id === REPO_FILTER)
    : config.repositories;

  if (REPO_FILTER && repos.length === 0) {
    console.error(`ERROR: No repository with id "${REPO_FILTER}" found in config/kb.json`);
    process.exit(1);
  }

  console.log(`KB sync${DRY_RUN ? ' [DRY RUN]' : ''} — ${repos.length} repo(s)`);

  let totalFiles = 0;
  for (const repo of repos) {
    try {
      const count = await syncRepo(repo, config, manifest);
      totalFiles += count;
    } catch (err) {
      console.error(`  ERROR syncing ${repo.id}: ${err.message}`);
    }
  }

  saveManifest(manifest);

  console.log(`\nSync complete${DRY_RUN ? ' (dry run — nothing written)' : ''}: ${totalFiles} file(s) fetched`);
  if (!DRY_RUN) {
    console.log('  kb/_manifest.json updated');
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
