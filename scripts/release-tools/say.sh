#!/usr/bin/env bash
# say.sh "<message>" <label> [wait_s=30] — send a chat message as the test user, wait, then capture the reply.
# Saves <label>_sent.png and <label>_response.png (+ hierarchy) and prints the chat text from the sent message on.
# Keyboard-safe: hides the keyboard only when it is shown. When the chat is the app's root screen, a bare `back`
# with the keyboard closed exits the app.
# Selectors come from config/flavors.json → flavors.$FLAVOR.aiTesting.selectors (FLAVOR defaults to main):
#   promptInput / submitButton  → passed to the send subflow as PROMPT_INPUT / SUBMIT_BUTTON
#   assistantLabel / userLabel  → accessibility labels of chat bubbles (printed as [label])
#   openAssistant               → if a `text:` selector, its label is dropped from the printed transcript
# SAY_SKIP_TEXTS="a|b"          → extra screen texts (e.g. chat header) to drop from the transcript.
source "$(dirname "$0")/_env.sh"; MSG="$1"; L="$2"; WAIT="${3:-30}"
[ -z "$MSG" ] || [ -z "$L" ] && { echo "usage: say.sh \"<message>\" <label> [wait_s]"; exit 1; }
hide_kb() { adb -s "$DEVICE" shell dumpsys input_method | grep -q "mInputShown=true" && adb -s "$DEVICE" shell input keyevent 4; }
SEL="$(node -e '
  const [root, id] = process.argv.slice(1);
  const f = (JSON.parse(require("fs").readFileSync(root + "/config/flavors.json", "utf8")).flavors || {})[id];
  if (!f) { console.error("say.sh: unknown flavor " + id + " in config/flavors.json"); process.exit(1); }
  const s = (f.aiTesting && f.aiTesting.selectors) || {};
  const x = v => String(v == null ? "" : v).replace(/\$\{(\w+)\}/g, (_, k) => process.env[k] || "").replace(/[\x1f\n]/g, " ");
  console.log([s.promptInput, s.submitButton, s.assistantLabel, s.userLabel, s.openAssistant].map(x).join("\x1f"));
' "$ROOT" "$FLAVOR")" || exit 1
IFS=$'\x1f' read -r PROMPT_INPUT SUBMIT_BUTTON ASSISTANT_LABEL USER_LABEL OPEN_ASSISTANT <<< "$SEL"
[ -z "$PROMPT_INPUT" ] || [ -z "$SUBMIT_BUTTON" ] && {
  echo "say.sh: flavors.$FLAVOR.aiTesting.selectors.promptInput / submitButton are not set"; exit 1; }
"$MAESTRO" --device "$DEVICE" test -e "MESSAGE=$MSG" -e "PROMPT_INPUT=$PROMPT_INPUT" -e "SUBMIT_BUTTON=$SUBMIT_BUTTON" \
  -e "APP_ID=$APP_ID" "$ROOT/flows/ai/_subflows/send_chat_message.yaml" >/dev/null 2>&1 \
  || { echo "SEND FAILED"; exit 1; }
echo "sent $(date +%T): $MSG"
adb -s "$DEVICE" exec-out screencap -p > "$SHOTS/${L}_sent.png"
for _ in $(seq 1 $(( WAIT / 5 ))); do sleep 5; done
hide_kb; sleep 1
"$(dirname "$0")/screen.sh" "${L}_response" >/dev/null 2>&1
echo "captured $(date +%T) $SHOTS/${L}_response.png"
python3 - "$SHOTS/hierarchy/${L}_response.json" "$MSG" "${ASSISTANT_LABEL#text:}" "${USER_LABEL#text:}" \
  "$( [[ "$OPEN_ASSISTANT" == text:* ]] && printf '%s' "${OPEN_ASSISTANT#text:}" )" "${SAY_SKIP_TEXTS:-}" <<'PY'
import sys, json, signal
signal.signal(signal.SIGPIPE, signal.SIG_DFL)
try: t = json.load(open(sys.argv[1]))
except Exception: print("  (no hierarchy — read the screenshot)"); sys.exit()
labels = tuple(x for x in sys.argv[3:5] if x)
skip = tuple(x for x in [sys.argv[5]] + sys.argv[6].split('|') if x)
out = []
def w(n):
    a = n.get('attributes', {}); tx = a.get('text', ''); ac = a.get('accessibilityText', '')
    if (len(tx) > 1 or ac in labels) and a.get('bounds'):
        out.append((int(a['bounds'].split(',')[1].split(']')[0]), tx or f'[{ac}]'))
    for c in n.get('children', []): w(c)
w(t)
lines = [x for _, x in sorted(out)]
start = next((i for i, x in enumerate(lines) if x.startswith(sys.argv[2][:30])), 0)
print("\n".join("  " + x for x in lines[start:] if x not in skip))
PY
