#!/bin/bash
# statusline.sh - ALS statusline for Claude Code
#
# Single-line statusline with inline delamain scanning. No daemon needed.
# Shows: branch, model, context, time, delamain badges
#
# Delamain discovery: walks up from cwd for .claude/delamains/,
# plus any additional roots listed in .claude/delamain-roots.

set +e

# ---------------------------------------------------------------------------
# Parse Claude Code's JSON input (single jq call)
# ---------------------------------------------------------------------------
input=$(cat)
IFS=$'\t' read -r cwd model used_pct <<< "$(
  echo "$input" | jq -r '[
    .workspace.current_dir // "",
    .model.display_name // "",
    (.context_window.used_percentage // "" | tostring)
  ] | @tsv'
)"

# Model: first word only — handles any model string gracefully
model_short="${model%% *}"

# Branch
branch=$(cd "$cwd" 2>/dev/null && git branch --show-current 2>/dev/null)

# ---------------------------------------------------------------------------
# Context bar
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
# Delamain discovery + inline scan
# ---------------------------------------------------------------------------
delamain_dirs=()
sr="$cwd"
while [[ "$sr" != "/" ]]; do
  [[ -d "$sr/.claude/delamains" ]] && delamain_dirs+=("$sr/.claude/delamains") && break
  sr=$(dirname "$sr")
done
rf="$cwd/.claude/delamain-roots"
if [[ -f "$rf" ]]; then
  while IFS= read -r er; do
    [[ -n "$er" && -d "$er/.claude/delamains" ]] && delamain_dirs+=("$er/.claude/delamains")
  done < "$rf"
fi

badges=""
for dp in "${delamain_dirs[@]}"; do
  for dy in "$dp"/*/delamain.yaml; do
    [[ -f "$dy" ]] || continue
    d_dir=$(dirname "$dy")
    d_name=$(basename "$d_dir")
    # First segment: development-pipeline → development
    slug="${d_name%%-*}"
    sf="$d_dir/status.json"

    symbol="○"; color="2;37"
    if [[ -f "$sf" ]]; then
      d_pid=$(grep -o '"pid"[^,}]*' "$sf" 2>/dev/null | grep -o '[0-9]*')
      if [[ -n "$d_pid" ]] && kill -0 "$d_pid" 2>/dev/null; then
        # Non-empty last_error = error state
        has_error=$(grep -o '"last_error" *: *"[^"][^"]*"' "$sf" 2>/dev/null)
        d_active=$(grep -o '"active_dispatches" *: *[0-9]*' "$sf" 2>/dev/null | grep -o '[0-9]*')
        if [[ -n "$has_error" ]]; then
          symbol="✗"; color="1;31"
        elif [[ -n "$d_active" && "$d_active" -gt 0 ]]; then
          symbol="⚡"; color="1;32"
        else
          symbol="✓"; color="32"
        fi
      fi
    fi

    badges+=$(printf ' \033[%sm[%s %s]\033[0m' "$color" "$slug" "$symbol")
  done
done

# ---------------------------------------------------------------------------
# Build single line
# ---------------------------------------------------------------------------
line=""
[[ -n "$branch" ]] && line+=$(printf '\033[1;33m⎇ %s\033[0m' "$branch")
[[ -n "$model_short" ]] && line+=$(printf ' \033[2;34m(%s)\033[0m' "$model_short")
line+="$context_info"
line+=$(printf ' \033[2;37mTIME %s\033[0m' "$(date +%H:%M)")
line+="$badges"

echo "$line"
