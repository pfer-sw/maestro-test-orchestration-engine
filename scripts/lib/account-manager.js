/**
 * account-manager.js
 * Resolves test accounts from config/accounts.json.
 *
 * Account registry lives in config/accounts.json (metadata + email, no passwords).
 * Passwords are stored in .env as ACCOUNT_<ID_UPPER>_PASS variables.
 *
 * Resolution priority when running a flow:
 *   1. taxonomy flow entry has `accountId`         → getAccount(id)
 *   2. taxonomy flow entry has `accountRequirements` → findAccount(query)
 *   3. flavor config has `defaultAccountId`         → getAccount(id)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const ACCOUNTS_PATH = resolve(ROOT, 'config', 'accounts.json');

let _cache = null;

/**
 * Load accounts from config/accounts.json (cached after first load).
 * @returns {object[]} Array of account objects
 */
export function loadAccounts() {
  if (!_cache) {
    const raw = readFileSync(ACCOUNTS_PATH, 'utf8');
    _cache = JSON.parse(raw).accounts;
  }
  return _cache;
}

/**
 * Get a specific account by its ID.
 * Throws if the account is not found.
 * @param {string} id
 * @returns {object} Account object
 */
export function getAccount(id) {
  const accounts = loadAccounts();
  const account = accounts.find((a) => a.id === id);
  if (!account) {
    throw new Error(`Account not found: "${id}". Check config/accounts.json.`);
  }
  return account;
}

/**
 * Find the first account matching all provided query criteria.
 * All specified fields must match (logical AND). Unspecified fields are ignored.
 *
 * - `flavor`: the account's `flavor` list must include it.
 * - `tags`:   every tag in query.tags must be present in account.tags.
 * - any other key: matches when `account[key]` or `account.traits[key]` equals the
 *   query value; when that value is an array, it must include the query value.
 *
 * @param {object} query
 * @param {string}   [query.flavor] - flavor the account must support (e.g. 'main')
 * @param {string[]} [query.tags]   - all listed tags must be present
 * @param {*}        [query.<key>]  - any account field or trait, e.g. { onboardingComplete: true, plan: 'free' }
 * @returns {object|null} First matching account, or null if none found
 */
export function findAccount(query) {
  const accounts = loadAccounts();
  return accounts.find((a) => matchesQuery(a, query)) ?? null;
}

function valueMatches(actual, expected) {
  if (Array.isArray(actual)) return actual.includes(expected);
  return actual === expected;
}

function matchesQuery(account, query) {
  for (const [key, expected] of Object.entries(query ?? {})) {
    if (expected === undefined) continue;
    if (key === 'flavor') {
      if (!(account.flavor ?? []).includes(expected)) return false;
    } else if (key === 'tags') {
      const tags = account.tags ?? [];
      for (const tag of [].concat(expected)) {
        if (!tags.includes(tag)) return false;
      }
    } else {
      const traits = account.traits ?? {};
      const hit = (key in account && valueMatches(account[key], expected))
        || (key in traits && valueMatches(traits[key], expected));
      if (!hit) return false;
    }
  }
  return true;
}

/**
 * Resolve the password for an account from process.env.
 * Uses the account's `passwordEnvVar` field.
 * Throws if the env var is missing or empty.
 * @param {object} account
 * @returns {string} The resolved password
 */
export function resolvePassword(account) {
  const envVar = account.passwordEnvVar;
  const password = process.env[envVar];
  if (!password) {
    throw new Error(
      `Password env var "${envVar}" is not set for account "${account.id}". Add it to .env.`
    );
  }
  return password;
}

/**
 * Build the Maestro env-var block for a given account.
 * Returns { TEST_USERNAME: email, TEST_PASSWORD: resolvedPassword }.
 * This is merged into the flow env before calling runFlow().
 * @param {object} account
 * @returns {{ TEST_USERNAME: string, TEST_PASSWORD: string }}
 */
export function getEnvVars(account) {
  return {
    TEST_USERNAME: account.email,
    TEST_PASSWORD: resolvePassword(account),
  };
}

/**
 * Resolve the account to use for a flow, following the priority chain:
 *   1. flow.accountId              → getAccount(id)
 *   2. flow.accountRequirements    → findAccount(query)
 *   3. flavor.defaultAccountId     → getAccount(id)
 *
 * Throws if no account can be resolved.
 *
 * @param {object} flow    - taxonomy flow entry
 * @param {object} flavor  - flavor config from flavors.json
 * @returns {object} Resolved account object
 */
export function resolveFlowAccount(flow, flavor) {
  if (flow.accountId) {
    const account = getAccount(flow.accountId);
    console.log(`   [account] ${flow.id}: using explicit account "${account.id}" (${account.email})`);
    return account;
  }

  if (flow.accountRequirements) {
    const account = findAccount(flow.accountRequirements);
    if (!account) {
      throw new Error(
        `No account matches requirements for flow "${flow.id}": ${JSON.stringify(flow.accountRequirements)}`
      );
    }
    console.log(`   [account] ${flow.id}: matched account "${account.id}" (${account.email}) via requirements`);
    return account;
  }

  if (flavor.defaultAccountId) {
    const account = getAccount(flavor.defaultAccountId);
    console.log(`   [account] ${flow.id}: using flavor default "${account.id}" (${account.email})`);
    return account;
  }

  throw new Error(
    `Cannot resolve account for flow "${flow.id}": no accountId, no accountRequirements, and flavor "${flavor.id}" has no defaultAccountId.`
  );
}
