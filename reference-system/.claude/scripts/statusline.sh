#!/bin/bash
# statusline.sh - Starship-inspired statusline for Claude Code

# Read JSON input from stdin
input=$(cat)

# Extract data from JSON
cwd=$(echo "$input" | jq -r '.workspace.current_dir')
model=$(echo "$input" | jq -r '.model.display_name')

# Get directory name (truncated path like Starship)
dir=$(basename "$cwd")

# Get git branch if in a git repo (with --git-dir to avoid optional locks)
branch=$(cd "$cwd" 2>/dev/null && git --git-dir="$(git rev-parse --git-dir 2>/dev/null)" branch --show-current 2>/dev/null)

# Calculate context usage with visual progress bar
# Use new percentage fields directly (added in Claude Code 2.1.x)
used_pct=$(echo "$input" | jq '.context_window.used_percentage // empty')
remaining_pct=$(echo "$input" | jq '.context_window.remaining_percentage // empty')
context_info=""
if [[ -n "$used_pct" && "$used_pct" != "null" ]]; then
    # Round to integer for display
    pct=${used_pct%.*}
    rem=${remaining_pct%.*}

    # Create progress bar with 10 blocks
    bar_width=10
    filled=$((pct * bar_width / 100))
    empty=$((bar_width - filled))

    # Build the bar string
    bar="["
    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=0; i<empty; i++)); do bar+="░"; done
    bar+="]"

    context_info=$(printf ' \033[2;35m%s %d%%\033[0m' "$bar" "$pct")
fi

# Scan for Delamain dispatchers via .claude/delamains/*/
# Walk up from cwd to find system root (directory containing .claude/)
delamain_count=0
delamain_badges=""
sys_root="$cwd"
while [[ "$sys_root" != "/" ]]; do
    if [[ -d "$sys_root/.claude/delamains" ]]; then
        break
    fi
    sys_root=$(dirname "$sys_root")
done

if [[ -d "$sys_root/.claude/delamains" ]]; then
    # Discover ALL delamains by looking for delamain.yaml
    for dy in "$sys_root"/.claude/delamains/*/delamain.yaml; do
        [[ -f "$dy" ]] || continue
        d_dir=$(dirname "$dy")
        d_name=$(basename "$d_dir")
        sf="$d_dir/status.json"
        delamain_count=$((delamain_count + 1))

        if [[ -f "$sf" ]]; then
            d_pid=$(jq -r '.pid // empty' "$sf" 2>/dev/null)
            d_active=$(jq -r '.active_dispatches // 0' "$sf" 2>/dev/null)
            d_error=$(jq -r '.last_error // empty' "$sf" 2>/dev/null)

            if [[ -n "$d_pid" ]] && kill -0 "$d_pid" 2>/dev/null; then
                if [[ -n "$d_error" ]]; then
                    # Alive but errored — red
                    delamain_badges+=$(printf ' \033[1;31m[%s ✗]\033[0m' "$d_name")
                elif (( d_active > 0 )); then
                    # Processing — bright green
                    delamain_badges+=$(printf ' \033[1;32m[%s ⚡]\033[0m' "$d_name")
                else
                    # On, idle — green
                    delamain_badges+=$(printf ' \033[32m[%s ✓]\033[0m' "$d_name")
                fi
            else
                # PID dead — errored
                delamain_badges+=$(printf ' \033[1;31m[%s ✗]\033[0m' "$d_name")
            fi
        else
            # Off — dimmed
            delamain_badges+=$(printf ' \033[2;37m[%s ○]\033[0m' "$d_name")
        fi
    done
fi

# Build status line with colors (using printf for ANSI codes)
# Colors match Starship config: cyan for directory, yellow for git branch, magenta for context
output=""

# Directory in cyan (bold)
output+=$(printf '\033[1;36m%s\033[0m' "$dir")

# Git branch in yellow with symbol if available
if [[ -n "$branch" ]]; then
    output+=$(printf ' \033[1;33m⎇ %s\033[0m' "$branch")
fi

# Add model name in dimmed blue
output+=$(printf ' \033[2;34m(%s)\033[0m' "$model")

# Add context usage percentage in dimmed magenta if available
output+="$context_info"

# Delamain badges on second line
if [[ $delamain_count -gt 0 ]]; then
    output+=$'\n'"$delamain_badges"
fi

echo "$output"
