#!/bin/bash
# animate.sh — Cycle mock delamain states to simulate live activity
#
# Usage:
#   ./animate.sh <target-claude-dir> [interval]
#
# Interval defaults to 5s (matches badge cache TTL).
# Ctrl+C to stop.

set -euo pipefail

TARGET="${1:?Usage: animate.sh <target-claude-dir> [interval]}"
INTERVAL="${2:-5}"

if [[ "$(basename "$TARGET")" != ".claude" ]]; then
    TARGET="$TARGET/.claude"
fi

CACHE_DIR="$TARGET/scripts/.cache"
TEST_FILE="$CACHE_DIR/test-mode"

if [[ ! -f "$TEST_FILE" ]]; then
    echo "ERROR: test mode not active ($TEST_FILE not found)" >&2
    echo "Run test.sh first to activate test mode" >&2
    exit 1
fi

# Read delamain names from test-mode file
names=()
while IFS='|' read -r name _; do
    [[ -n "$name" ]] && names+=("$name")
done < "$TEST_FILE"

echo "[animate] ${#names[@]} delamains, cycling every ${INTERVAL}s — Ctrl+C to stop"

states=("active" "idle" "active" "active" "idle" "active")
tick=0

while true; do
    output=""
    for i in "${!names[@]}"; do
        # Each delamain cycles through states at a different offset
        # so they don't all change at once
        si=$(( (tick + i) % ${#states[@]} ))
        state="${states[$si]}"

        # Randomly inject error/off for variety (10% chance each tick per badge)
        roll=$(( RANDOM % 100 ))
        if (( roll < 3 )); then
            state="error"
        elif (( roll < 6 )); then
            state="off"
        fi

        output+="${names[$i]}|${state}\n"
    done

    printf "$output" > "$TEST_FILE"
    # Clear badge cache so statusline picks up new states on next render
    rm -f "$CACHE_DIR/badges" "$CACHE_DIR/badges-w" 2>/dev/null

    tick=$((tick + 1))
    sleep "$INTERVAL"
done
