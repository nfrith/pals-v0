#!/bin/bash
# Scan delamains and output status + commands for the skill preprocessor

# Walk up from cwd to find system root
sys_root="$(pwd)"
while [[ "$sys_root" != "/" ]]; do
    [[ -d "$sys_root/.claude/delamains" ]] && break
    sys_root=$(dirname "$sys_root")
done

if [[ ! -d "$sys_root/.claude/delamains" ]]; then
    echo "No .claude/delamains/ found in parent directories. Nothing to start."
    exit 0
fi

echo "System root: \`$sys_root\`"
echo ""
echo "| Delamain | Status | PID |"
echo "|----------|--------|-----|"

offline_cmds=()

for dy in "$sys_root"/.claude/delamains/*/delamain.yaml; do
    [[ -f "$dy" ]] || continue
    d_dir=$(dirname "$dy")
    d_name=$(basename "$d_dir")
    sf="$d_dir/status.json"

    [[ -d "$d_dir/dispatcher" ]] || continue

    if [[ -f "$sf" ]]; then
        d_pid=$(jq -r '.pid // empty' "$sf" 2>/dev/null)
        if [[ -n "$d_pid" ]] && kill -0 "$d_pid" 2>/dev/null; then
            echo "| $d_name | running | $d_pid |"
            continue
        fi
    fi

    echo "| $d_name | **offline** | - |"
    offline_cmds+=("cd $sys_root/.claude/delamains/$d_name/dispatcher && bun install --silent 2>/dev/null && bun run src/index.ts")
done

echo ""

if (( ${#offline_cmds[@]} == 0 )); then
    echo "All dispatchers are running. Nothing to do."
else
    echo "## Start commands"
    echo ""
    echo "Run each offline dispatcher as a background shell:"
    echo ""
    for cmd in "${offline_cmds[@]}"; do
        echo "- \`$cmd\`"
    done
fi
