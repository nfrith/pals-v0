#!/bin/bash
# operator-config-session-start.sh — SessionStart hook
# Injects the operator profile when a valid operator config exists.

set -euo pipefail

command -v bun >/dev/null 2>&1 || exit 0

compiler_cli="${CLAUDE_PLUGIN_ROOT}/alsc/compiler/src/cli.ts"
[[ -f "$compiler_cli" ]] || exit 0

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // empty')

if [[ -n "$cwd" ]]; then
  bun "$compiler_cli" operator-config session-start "$cwd" 2>/dev/null || true
else
  bun "$compiler_cli" operator-config session-start 2>/dev/null || true
fi
