#!/usr/bin/env bash
# Polls origin/master and rebuilds/restarts the docker compose stack whenever
# a new commit lands, so the local containers stay in sync with GitHub.
#
# Usage:
#   ./scripts/autodeploy.sh            # poll every 30s (default)
#   POLL_INTERVAL=60 ./scripts/autodeploy.sh
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$REPO_ROOT"

POLL_INTERVAL="${POLL_INTERVAL:-30}"
BRANCH="master"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"; }

log "Watching origin/$BRANCH every ${POLL_INTERVAL}s. Ctrl+C to stop."

while true; do
  git fetch --quiet origin "$BRANCH"
  LOCAL_SHA="$(git rev-parse "$BRANCH")"
  REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

  if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
    log "New commit on origin/$BRANCH ($LOCAL_SHA -> $REMOTE_SHA). Redeploying..."
    git merge --ff-only "origin/$BRANCH"
    docker compose build
    docker compose up -d
    log "Redeploy complete."
  fi

  sleep "$POLL_INTERVAL"
done
