#!/bin/bash
# statusline.sh - ALS statusline for Claude Code
#
# PURE READER: This script reads pre-collected data from cache files
# written by statusline-daemon.sh. It performs NO scanning, NO jq on
# delamain status files, NO git commands, NO python/websocket calls.
#
# Execution time: ~5-10ms. Fast enough that Claude Code's 300ms debounce
# can never cancel it, even with 10+ background shells running.
#
# If the daemon isn't running (no cache files), gracefully degrades to
# showing just directory, model, context, and clock — no badges.
#
# See CLAUDE.md in this directory for full documentation.

set +e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CACHE_DIR="$SCRIPT_DIR/.cache"

# Signal trap: output last render and exit 0 on cancellation
_on_signal() {
  [[ -f "$CACHE_DIR/last-render" ]] && cat "$CACHE_DIR/last-render"
  exit 0
}
trap '_on_signal' TERM INT PIPE

# ---------------------------------------------------------------------------
# Parse Claude Code's JSON input (single jq call for all 3 fields)
# ---------------------------------------------------------------------------
input=$(cat)
IFS=$'\t' read -r cwd model used_pct <<< "$(
  echo "$input" | jq -r '[
    .workspace.current_dir // "",
    .model.display_name // "",
    (.context_window.used_percentage // "" | tostring)
  ] | @tsv'
)"

dir=$(basename "$cwd")

# ---------------------------------------------------------------------------
# Context bar (inline math, no subshells)
# ---------------------------------------------------------------------------
context_info=""
if [[ -n "$used_pct" && "$used_pct" != "null" && "$used_pct" != "" ]]; then
    pct=${used_pct%.*}
    filled=$((pct * 10 / 100))
    empty=$((10 - filled))
    bar="["
    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=0; i<empty; i++)); do bar+="░"; done
    bar+="]"
    context_info=$(printf ' \033[2;35m%s %d%%\033[0m' "$bar" "$pct")
fi

# ---------------------------------------------------------------------------
# Read cached data (written by statusline-daemon.sh — no scanning here)
# ---------------------------------------------------------------------------
branch=$(cat "$CACHE_DIR/git-branch" 2>/dev/null)

# OBS indicator from daemon's pre-computed state string
obs_indicator=""
obs_state=$(cat "$CACHE_DIR/obs-state" 2>/dev/null)
if [[ -n "$obs_state" ]]; then
    blink_on=$(( $(date +%s) % 2 ))
    if [[ "$obs_state" == "streaming" ]]; then
        if (( blink_on )); then obs_indicator=$(printf ' \033[1;31m● LIVE\033[0m')
        else obs_indicator=$(printf ' \033[2;31m○ LIVE\033[0m'); fi
    elif [[ "$obs_state" == "recording" ]]; then
        if (( blink_on )); then obs_indicator=$(printf ' \033[1;33m● REC\033[0m')
        else obs_indicator=$(printf ' \033[2;33m○ REC\033[0m'); fi
    fi
fi

# ---------------------------------------------------------------------------
# Build output
# ---------------------------------------------------------------------------
output=""

line1=""
line1+=$(printf '\033[1;36m%s\033[0m' "$dir")
[[ -n "$branch" ]] && line1+=$(printf ' \033[1;33m⎇ %s\033[0m' "$branch")
line1+=$(printf ' \033[2;34m(%s)\033[0m' "$model")
line1+="$context_info"
line1+=$(printf ' \033[2;37mTIME %s\033[0m' "$(date +%H:%M)")
line1+="$obs_indicator"

output+="$line1"

# Delamain badges (pre-rendered by daemon)
badges_raw=$(cat "$CACHE_DIR/badges" 2>/dev/null)
widths_raw=$(cat "$CACHE_DIR/badges-w" 2>/dev/null)
badges_per_line=4

if [[ -n "$badges_raw" ]]; then
    IFS='|' read -ra badge_arr <<< "$badges_raw"
    IFS='|' read -ra width_arr <<< "$widths_raw"

    max_w=0
    for w in "${width_arr[@]}"; do
        [[ -n "$w" ]] && (( w > max_w )) && max_w=$w
    done

    line=""
    count=0
    for i in "${!badge_arr[@]}"; do
        b="${badge_arr[$i]}"
        [[ -z "$b" ]] && continue
        bw="${width_arr[$i]:-0}"
        pad=$(( max_w - bw ))
        padding=""
        (( pad > 0 )) && printf -v padding "%${pad}s" ""
        if (( count > 0 && count % badges_per_line == 0 )); then
            output+=$'\n'"$line"
            line=""
        fi
        line+=" ${b}${padding}"
        count=$((count + 1))
    done
    [[ -n "$line" ]] && output+=$'\n'"$line"
fi

echo "$output"
echo "$output" > "$CACHE_DIR/last-render"
