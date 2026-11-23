# Knowledge base

Ground truth injected into Layer 2 semantic evaluation. Sources are declared in
[`config/kb.json`](../config/kb.json) and split by **provenance**, because the two
kinds have opposite rules.

| | Synced mirrors | `kb/local/` |
|---|---|---|
| Origin | An upstream repo that owns the content | Authored here; no upstream owner |
| In git | **No** — ignored | **Yes** — this is the only copy |
| Refresh | `npm run sync-kb`, or `git pull` in the checkout | Edit in place |
| Staleness check | Yes, warns past `maxAgeDays` (default 7) | Exempt (`authored: true`) |
| If deleted | Re-sync | **Gone** |

## Why the split

A mirror must never be committed — a second copy of content owned elsewhere
drifts silently, and you end up scoring evaluations against a snapshot nobody
maintains. If a file here carries a `Source: <upstream path>` header and that
upstream is already a configured source, delete the copy and load the upstream.

Authored content has the opposite failure mode. `kb/local/` holds material with
no upstream owner — if it is not in git, a single disk is the only copy.

## Staleness

At the start of every `test` run, `checkStaleness()` (`scripts/lib/kb-client.js`) compares each
synced source's last sync with `maxAgeDays` and prints a warning naming the source; the run
continues. `authored: true` sources are exempt.

## Current sources

Matches `config/kb.json`.

| Source id | Type | Location | Notes |
|---|---|---|---|
| `local-supplements` | authored | `kb/local/` (tracked) | `kb/local/rules/` — product rules, see [`local/rules/README.md`](local/rules/README.md); `kb/local/release/` — runbooks, never injected (`excludeDirs: ["release"]`), see [`local/release/README.md`](local/release/README.md) |
| `ai-documentation` | synced mirror (local checkout) | `localPath: ${AI_DOCUMENTATION_PATH:-~/sword-ai/ai-documentation}` → `docs/pulse/`, `docs/common/` | SWORDHealth/ai-documentation — what Phoenix's prompts are built from. Refresh with `git pull` in the checkout. Tag `pulse` |
| `ai-services` | synced mirror (local checkout) | `localPath: ${AI_SERVICES_PATH:-~/sword-ai/ai-services}` → `src/monalisa/docs/`, `docs/` | SWORDHealth/ai-services — Phoenix (Monalisa) code + design docs. Reference only, never injected (no `protocolTags`) |

## Wiki pages (`kb/wiki/`)

`npm run fetch-wiki -- <url|slugId> --out=kb/wiki/<name>.md` pulls a wiki page as Markdown with a
provenance header (source, page `updatedAt`, fetch date). It needs `WIKI_BASE_URL` (the wiki's
base URL) and `WIKI_API_KEY` (a personal API key, which reads private pages too) in `.env` — the
tester sets them; Claude never reads `.env`.

`kb/wiki/` is a mirror — gitignored, refresh on demand, never edited. Condense what tests need
into `kb/local/rules/` and cite the page + `updatedAt` there.

## Adding authored content

Add a `.md` file under `kb/local/rules/` with the frontmatter header (`scope`, `status`,
`verifiedOn`, `evaluator`), add its row to the File index and Context pack in
[`local/rules/README.md`](local/rules/README.md), and commit it. **Evaluator use is opt-in per
file**: nothing reaches Layer 2 unless it says `evaluator: include` and its `status` is not
`unverified`. Source-level `protocolTags` on `local-supplements` still decide which protocols see it.

**This is a holding position, not the destination.** Authored KB content should
migrate to a repo that owns it, leaving this directory empty. Until then, treat
anything here as unbacked-up-by-default and make sure it is committed.

## Known limitations

`buildKbContext` truncates to `tokenBudgetPerEval` (default 6000 tokens ≈ 24,000
chars) by slicing the concatenated result in directory-walk order. With a large
source, **only the first couple of files survive**, and `protocolTags` filter per
*source*, not per *file* — so different protocols can receive identical content.

Until ranking is per-file and budget is reserved per source, do not assume a
file in this directory reached the evaluator. Verify before relying on it.

No script calls `buildKbContext` today — injection happens when Claude follows the
evaluator swap in `CLAUDE.md` during a run. `kb/_manifest.json` can also list files for a
source whose directory is empty; check the directory, not the manifest.
