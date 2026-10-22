# Shared settings for release-tools. Override per run:  DEVICE=<serial> RUN_DATE=YYYY-MM-DD <tool>
# Variables come from the shell or, if present, the repo's .env (values exported in the shell win).
# Required: APP_ID=<package name of the app under test> — or, with several flavors, <FLAVOR>_APP_ID
#           in .env (e.g. FLAVOR=member → MEMBER_APP_ID), see config/README.md → flavors.json
# Optional: SPLASH=<launch activity class> (relaunch.sh falls back to the launcher intent when unset)
#           FLAVOR=<flavor id in config/flavors.json> (default: main — used for chat selectors and
#           <FLAVOR>_APP_ID; export it after renaming the flavor)
#           NET_LOG_TAG (net.sh)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
_SHELL_APP_ID="${APP_ID:-}"; _SHELL_FLAVOR="${FLAVOR:-}"; _SHELL_SPLASH="${SPLASH:-}"
set -a; [ -f "$ROOT/.env" ] && . "$ROOT/.env"; set +a
[ -n "$_SHELL_APP_ID" ] && APP_ID="$_SHELL_APP_ID"
[ -n "$_SHELL_FLAVOR" ] && FLAVOR="$_SHELL_FLAVOR"
[ -n "$_SHELL_SPLASH" ] && SPLASH="$_SHELL_SPLASH"
FLAVOR="${FLAVOR:-main}"
if [ -z "${APP_ID:-}" ]; then
  _FLAVOR_APP_ID_VAR="$(printf '%s' "$FLAVOR" | tr '[:lower:]-' '[:upper:]_')_APP_ID"
  APP_ID="${!_FLAVOR_APP_ID_VAR:-}"
fi
DEVICE="${DEVICE:-$(adb devices | awk 'NR>1 && $2=="device"{print $1; exit}')}"
RUN_DATE="${RUN_DATE:-$(date +%F)}"
if [ -z "${APP_ID:-}" ]; then
  echo "release-tools: APP_ID is not set — export APP_ID=<package name of the app under test> (e.g. com.example.notes), or set APP_ID / ${_FLAVOR_APP_ID_VAR:-<FLAVOR>_APP_ID} in .env" >&2
  exit 1
fi
SPLASH="${SPLASH:-}"
MAESTRO="${MAESTRO:-$HOME/.maestro/bin/maestro}"
SHOTS="$ROOT/screenshots/test_runs/$RUN_DATE"
mkdir -p "$SHOTS/hierarchy" "$SHOTS/capture"
