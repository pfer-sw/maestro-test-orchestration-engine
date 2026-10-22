#!/usr/bin/env bash
# screen.sh <label> — screenshot + Maestro hierarchy JSON + compact element list (text · id · a11y · clickable).
# Uses `maestro hierarchy` because `uiautomator dump` returns nothing while the Maestro driver is attached.
source "$(dirname "$0")/_env.sh"; L="$1"
adb -s "$DEVICE" exec-out screencap -p > "$SHOTS/$L.png"
"$MAESTRO" --device "$DEVICE" hierarchy 2>/dev/null > "$SHOTS/hierarchy/$L.json"
echo "[$(date +%T)] $L  $(adb -s "$DEVICE" shell dumpsys activity activities | grep -m1 topResumedActivity | sed 's/.*\///;s/ t[0-9]*}//')"
python3 - "$SHOTS/hierarchy/$L.json" "$APP_ID" <<'PY'
import sys,json,signal
signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # `screen.sh … | head` must not raise BrokenPipeError
try: t=json.load(open(sys.argv[1]))
except Exception as e: print("  (no hierarchy)", e); sys.exit()
pref=sys.argv[2]+":id/"
def w(n):
  a=n.get('attributes',{}); rid=a.get('resource-id','').replace(pref,''); tx=a.get('text',''); ac=a.get('accessibilityText',''); c=a.get('clickable')=='true'
  if not(rid.startswith(('com.android.systemui','com.sec.')) or rid in('android:id/content','action_bar_root')) and (tx or ac or c or (rid and not rid.startswith('android'))):
    print(f"  {'◉' if c else ' '} {('#'+rid) if rid else '·'} {repr(tx[:70]) if tx else ''} {('a11y='+repr(ac[:40])) if ac else ''} {a.get('bounds','')}")
  for k in n.get('children',[]): w(k)
w(t)
PY
