#!/usr/bin/env bash
# pi-web deploy: build, test, smoke, backup, swap, restart, verify, log.
# Run from the repo root on strategy-c. Fails closed: any failed step aborts
# without touching the installed binary.
set -euo pipefail

BIN="$HOME/.pi/agent/bin/pi-web"
LOG="$HOME/pi-web-docs/DEPLOYS.md"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
COMMIT="$(git rev-parse --short HEAD)"
BACKUP="$HOME/backups/pi-web-deploy-$STAMP-$COMMIT"
TMPBIN="/tmp/pi-web-$STAMP"
SMOKE_AGENT_DIR="$(mktemp -d /tmp/pi-web-smoke-agent.XXXXXX)"
cleanup() { kill "${SMOKE_PID:-}" 2>/dev/null || true; rm -rf "$SMOKE_AGENT_DIR"; }
trap cleanup EXIT

[[ -f "$LOG" ]] || mkdir -p "$(dirname "$LOG")"

# 1. clean tree
if [[ -n "$(git status --porcelain)" ]]; then
    echo "ABORT: dirty tree"; git status --porcelain; exit 1
fi

# 2. build (frontend first — the Go embed needs web/dist to exist)
(cd web && npm ci --silent && npm run build)
[[ -d web/dist ]] || { echo "ABORT: web/dist missing"; exit 1; }
grep -rq "pi-chat-rewind" web/dist || { echo "ABORT: pi-chat-rewind marker not in web/dist"; exit 1; }

export PATH=/nix/store/fkz7zn1a0yiryf9kri2yh1s12k1sv557-go-1.26.10/bin:$PATH GOCACHE="$HOME/.cache/go-build" CGO_ENABLED=0
go build -ldflags="-s -w -X main.version=$COMMIT" -o "$TMPBIN" ./cmd/pi-web
[[ $(grep -a -c pi-chat-rewind "$TMPBIN") -gt 0 ]] || { echo "ABORT: pi-chat-rewind not in binary"; exit 1; }

# 3. tests — a failure must abort
if ! (cd web && npx vitest run); then
    echo "ABORT: vitest failed"; rm -f "$TMPBIN"; exit 1
fi
GO_OUT="$(go test ./... 2>&1)" || { echo "ABORT: go test failed"; echo "$GO_OUT"; rm -f "$TMPBIN"; exit 1; }
echo "$GO_OUT" | grep -v '^ok\|no test files' || true

# 4. smoke on a temp port, temp agent dir (never the production db)
PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()")
PI_CODING_AGENT_DIR="$SMOKE_AGENT_DIR" "$TMPBIN" -p "$PORT" -host 127.0.0.1 &
SMOKE_PID=$!
sleep 2
curl -sf "http://127.0.0.1:$PORT/login" >/dev/null || { echo "ABORT: smoke failed"; exit 1; }
kill "$SMOKE_PID" 2>/dev/null || true; SMOKE_PID=""

# 5. nothing changed?
if [[ -f "$BIN" ]] && [[ "$(sha256sum "$BIN" | cut -d' ' -f1)" == "$(sha256sum "$TMPBIN" | cut -d' ' -f1)" ]]; then
    echo "nada mudou"
    rm -f "$TMPBIN"
    exit 0
fi

# 6. backup (binary, db, mcp configs)
mkdir -p "$BACKUP"
cp -a "$BIN" "$BACKUP/" 2>/dev/null || true
for f in pi-web.sqlite mcp.json mcp-auth.json; do
    [[ -f "$HOME/.pi/agent/$f" ]] && cp -a "$HOME/.pi/agent/$f" "$BACKUP/"
done

# 7. swap + restart + verify (local + tailnet)
install -m 755 "$TMPBIN" "$BIN"
rm -f "$TMPBIN"
echo "pi-web reiniciando por alguns segundos (deploy $COMMIT)"
systemctl --user restart pi-web
sleep 3
fail() { echo "ROLLBACK: $1"; cp -a "$BACKUP/pi-web" "$BIN"; systemctl --user restart pi-web;
         echo "| $STAMP | $COMMIT | $(sha256sum "$BIN" | cut -d' ' -f1) | rollback ($1) |" >> "$LOG"; exit 1; }
[[ $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:31415/" 2>/dev/null) =~ ^(200|401|302)$ ]] \
    || fail "local health"
TSCODE=$(curl -s -o /dev/null -w '%{http_code}' "https://strategy-c.tail40db1.ts.net/" 2>/dev/null || echo "fail")
[[ $TSCODE =~ ^(200|401|302)$ ]] || fail "tailnet health ($TSCODE)"
MAINPID=$(systemctl --user show -p MainPID --value pi-web 2>/dev/null || echo 0)
RUNNING_SHA=$([[ "$MAINPID" -gt 0 ]] && sha256sum "/proc/$MAINPID/exe" 2>/dev/null | cut -d' ' -f1 || echo "")
[[ "$RUNNING_SHA" == "$(sha256sum "$BIN" | cut -d' ' -f1)" ]] || fail "running process is not the new binary"
echo "OK: $COMMIT deployed (local+tailnet healthy, running=installed)"
echo "| $STAMP | $COMMIT | $(sha256sum "$BIN" | cut -d' ' -f1) | ok |" >> "$LOG"
