#!/usr/bin/env bash
# switch-account.sh <account> [label] — log the app into another test user: logout → login → post-login prompts.
# <account>: an id from config/accounts.json, or a unique substring of the id / email / notes name (`Member "Jane Doe"`).
#            Ambiguous → lists the matches and stops (never guesses: a wrong-account switch spoils the run).
# [label]: short leg name shown on every say.sh line (e.g. LEG-A); defaults to the account id.
# Prints "now: <label> <name> <email>" and writes it to screenshots/.current_account (say.sh reads it).
# Password: the account's passwordEnvVar, from the shell or .env (never printed).
# Flow: flows/baseline/_subflows/switch_account.yaml — fill in your app's ids first.
source "$(dirname "$0")/_env.sh"; Q="$1"; LABEL="$2"
[ -z "$Q" ] && { echo "usage: switch-account.sh <account id|substring> [label]"; exit 1; }
[ -z "$DEVICE" ] && { echo "no Android device attached"; exit 1; }
read -r ID EMAIL PASSVAR MEMBER < <(python3 - "$ROOT/config/accounts.json" "$Q" <<'PY'
import sys, json, re
accts = json.load(open(sys.argv[1]))["accounts"]; q = sys.argv[2].lower()
def member(a):
    m = re.search(r'Member "([^"]+)"', a.get("notes", "")); return m.group(1) if m else "-"
exact = [a for a in accts if a["id"].lower() == q]
hits = exact or [a for a in accts if q in a["id"].lower() or q in a["email"].lower() or q in member(a).lower()]
if len(hits) != 1:
    print(f"{len(hits)} accounts match '{sys.argv[2]}':", file=sys.stderr)
    for a in hits[:15]: print(f"  {a['id']}  {member(a)}  {a['email']}", file=sys.stderr)
    sys.exit(1)
a = hits[0]; print(a["id"], a["email"], a["passwordEnvVar"], member(a).replace(" ", "_"))
PY
) || exit 1
MEMBER="${MEMBER//_/ }"; LABEL="${LABEL:-$ID}"
PASS="${!PASSVAR:-}"                              # _env.sh already loaded .env (shell values win)
[ -z "$PASS" ] && { echo "$PASSVAR is not set in .env — add it, then rerun"; exit 1; }
echo "switching to $LABEL ($MEMBER, $EMAIL)…"
# SWITCH_TIMING=1 prints the steps that took 1.5 s or more (Maestro debug output, deleted afterwards — it holds the password).
DBG="$SHOTS/capture/.switch_debug"; rm -rf "$DBG"; T0=$SECONDS
perl -e 'alarm shift; exec @ARGV' 240 "$MAESTRO" --device "$DEVICE" test ${SWITCH_TIMING:+--debug-output "$DBG"} -e "APP_ID=$APP_ID" \
  -e "TEST_USERNAME=$EMAIL" -e "TEST_PASSWORD=$PASS" \
  "$ROOT/flows/baseline/_subflows/switch_account.yaml" >/dev/null 2>&1; RC=$?
[ -n "$SWITCH_TIMING" ] && python3 - "$DBG" <<'PY'
import json, sys, glob, os
files = sorted(glob.glob(os.path.join(sys.argv[1], "**", "commands*.json"), recursive=True))
rows = []
for entry in (json.load(open(files[-1])) if files else []):
    cmd, meta = entry.get("command", {}), entry.get("metadata", {})
    name = next(iter(cmd), "?")
    body = "" if any(k in name.lower() for k in ("input", "define")) else json.dumps(cmd.get(name))[:100]   # never print typed text
    rows.append((meta.get("timestamp", 0), meta.get("duration", 0) or 0, str(meta.get("status")), name, body))
rows.sort()
for ts, dur, status, name, body in rows:
    if dur >= 1500 or status == "FAILED": print(f"  {(ts - rows[0][0]) / 1000:6.1f}s  +{dur / 1000:5.1f}s  {status:10} {name:26} {body}")
PY
rm -rf "$DBG"
[ $RC -ne 0 ] && { echo "SWITCH FAILED after $((SECONDS - T0)) s — check the screen (screen.sh switch_failed)"; rm -f "$ROOT/screenshots/.current_account"; exit 1; }
echo "switched in $((SECONDS - T0)) s"
echo "$LABEL $MEMBER $EMAIL" > "$ROOT/screenshots/.current_account"
sleep 3; "$(dirname "$0")/screen.sh" "switch_${LABEL}" >/dev/null 2>&1
echo "now: $LABEL $MEMBER $EMAIL  (landing: $SHOTS/switch_${LABEL}.png)"
