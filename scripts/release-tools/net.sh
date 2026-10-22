#!/usr/bin/env bash
# net.sh — the app's HTTP traffic from logcat (dev build with an HTTP logging interceptor; logcat tag from
#   NET_LOG_TAG, default okhttp.OkHttpClient — the OkHttp HttpLoggingInterceptor tag).
#   net.sh calls [HH:MM:SS]   requests + responses (method, path, status, ms) from the logcat buffer, optionally since a time
#   net.sh grep <regex>       full lines (headers + JSON bodies) matching <regex>, e.g. a path like 'watched-time'
#   net.sh start <name>       stream all traffic to capture/<name>/net.log in the background (the buffer holds ~1 MiB only)
#   net.sh stop <name>
# Authorization / cookie values are redacted before printing or saving. Logs stay under screenshots/ (gitignored).
source "$(dirname "$0")/_env.sh"
TAG="${NET_LOG_TAG:-okhttp.OkHttpClient}"
TAG_RE="$(printf '%s' "$TAG" | sed 's/[.[\*^$]/\\&/g')"
redact() { sed -E 's/((A|a)uthorization: ).*/\1<redacted>/; s/((set-)?(C|c)ookie: ).*/\1<redacted>/'; }
dump() { adb -s "$DEVICE" logcat -d -v time -s "$TAG:I" | redact; }
case "$1" in
  calls) dump | grep -E -- '(-->|<--) [A-Z0-9]' | grep -v -E -- '(-->|<--) END' \
           | awk -v s="${2:-00:00:00}" '$2 >= s' | sed -E "s/\?[^ ]*//; s#https://[^/]+##; s/I\/${TAG_RE}\([ 0-9]+\): //" ;;
  grep)  dump | grep -E -- "$2" ;;
  start) N="$SHOTS/capture/$2"; mkdir -p "$N"
         ( adb -s "$DEVICE" logcat -v time -T 1 -s "$TAG:I" | redact >> "$N/net.log" ) &
         echo $! > "$N/net.pid"; echo "streaming -> $N/net.log" ;;
  stop)  N="$SHOTS/capture/$2"; P="$(cat "$N/net.pid")"; pkill -P "$P" 2>/dev/null; kill "$P" 2>/dev/null; rm -f "$N/net.pid"; echo "stopped $N/net.log" ;;
  *)     sed -n '2,8p' "$0" ;;
esac
