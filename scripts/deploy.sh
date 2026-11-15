#!/usr/bin/env bash
# pi-web deploy: build, test, smoke, backup, swap, restart, verify, log.
set -euo pipefail

BIN="$HOME/.pi/agent/bin/pi-web"
LOG="$HOME/pi-web-docs/DEPLOYS.md"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
COMMIT="$(git rev-parse --short HEAD)"
BACKUP="$HOME/backups/pi-web-deploy-$STAMP-$COMMIT"
TMPBIN="/tmp/pi-web-$STAMP"

[[ -f "$LOG" ]] || mkdir -p "$(dirname "$LOG")"

# 1. clean tree
if [[ -n "$(git status --porcelain)" ]]; then
    echo "ABORT: dirty tree"; git status --porcelain; exit 1
fi

# 2. build
(cd web && npm ci --silent && npm run build)
export PATH=/nix/store/fkz7zn1a0yiryf9kri2yh1s12k1sv557-go-1.26.10/bin:$PATH GOCACHE="$HOME/.cache/go-build" CGO_ENABLED=0
go build -ldflags="-s -w -X main.version=$COMMIT" -o "$TMPBIN" ./cmd/pi-web

# 3. tests
make test || { echo "ABORT: tests failed"; rm -f "$TMPBIN"; exit 1; }

# 4. smoke on a temp port (127.0.0.1 only)
PORT=$(python3 -c "import socket; s=socket.socket(); s.bind((\"127.0.0.1\",0)); print(s.getsockname()[1]); s.close()")
"$TMPBIN" --port "$PORT" --host 127.0.0.1 &
SMOKE_PID=$!
sleep 2
curl -sf "http://127.0.0.1:$PORT/login" >/dev/null || { echo "ABORT: smoke failed"; kill $SMOKE_PID; exit 1; }
curl -sf "http://127.0.0.1:$PORT/" | grep -q "pi-chat-rewind" || echo "WARN: rewind marker not in served JS (may be expected on older commits)"
kill $SMOKE_PID 2>/dev/null || true

# 5. nothing changed?
if [[ -f "$BIN" ]] && [[ "$(sha256sum "$BIN" | cut -d" " -f1)" == "$(sha256sum "$TMPBIN" | cut -d" " -f1)" ]]; then
    echo "nada mudou"
    rm -f "$TMPBIN"
    exit 0
fi

# 6. backup
mkdir -p "$BACKUP"
cp -a "$BIN" "$BACKUP/" 2>/dev/null || true
[[ -f "$HOME/.pi/agent/pi-web.sqlite" ]] && cp -a "$HOME/.pi/agent/pi-web.sqlite" "$BACKUP/"

# 7. swap + restart + verify
install -m 755 "$TMPBIN" "$BIN"
rm -f "$TMPBIN"
systemctl --user restart pi-web
sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:31415/" 2>/dev/null || echo "fail")
if [[ "$HEALTH" != "200" && "$HEALTH" != "401" && "$HEALTH" != "302" ]]; then
    echo "ROLLBACK: health=$HEALTH"
    cp -a "$BACKUP/pi-web" "$BIN"
    systemctl --user restart pi-web
    echo "rolled back"; exit 1
fi
echo "OK: $COMMIT deployed (health=$HEALTH)"

# 8. log
echo "| $STAMP | $COMMIT | $(sha256sum "$BIN" | cut -d" " -f1) | ok |" >> "$LOG"
