# statusline/

Canonical ALS statusline for Claude Code. Installed into operator projects via `/configure-statusline`.

## How Claude Code statusline works

The statusline is a shell script that Claude Code runs after each assistant message. Claude Code pipes session JSON to stdin and displays whatever stdout produces. Each `echo` = one row.

**Official docs:** https://code.claude.com/docs/en/statusline

### Critical performance constraints

- **300ms debounce**: Rapid updates batch together. If a new update triggers while the script is still running, the in-flight execution is **cancelled**.
- **Non-zero exit or no output = blank**: If the script errors or produces nothing, the statusline disappears entirely.
- **Background shells amplify the problem**: With many background shells running (dispatchers, traffic generators), state changes trigger statusline updates far more frequently. A slow script gets cancelled repeatedly, resulting in a permanently blank statusline.

**Target execution time: under 200ms.** Current measured time: ~180ms.

### What causes statusline to disappear

Investigated 2026-04-08 during GHOST-163 demo polish. The statusline was working, then disappeared when 10 background shells (5 traffic generators + 5 dispatchers) were started.

**Root cause:** The original script made 6+ `jq` calls, `git` commands, `kill -0` checks per PID, and a Python WebSocket call to OBS — all on every render. Total execution time exceeded 300ms. With background shells triggering rapid updates, every execution got cancelled before producing output.

**Fix:** Aggressive caching. Delamain badge scan (5s TTL), git branch (10s TTL), OBS status (5s TTL), terminal width (per-session). The hot path only reads cache files and formats output.

**Sources:**
- Official statusline docs: https://code.claude.com/docs/en/statusline
- ccstatusline project (implementation reference): https://github.com/sirmalloc/ccstatusline
- Issue #29383 (statusline disappears): https://github.com/anthropics/claude-code/issues/29383
- Issue #33310 (background task count not in JSON): https://github.com/anthropics/claude-code/issues/33310
- Issue #11716 (background bash infinite system-reminders): https://github.com/anthropics/claude-code/issues/11716

### Other known behaviors

- **Hides during UI interactions**: autocomplete, help menu, permission prompts
- **Right-side notifications share the row**: MCP errors, token warnings, "approaching limit" messages render on the right side of the statusline row and can truncate output
- **tmux strips output**: The statusline does not render inside tmux. Must run Ghostty (or other terminal) directly.
- **stderr kills rendering**: Any stderr output from the script causes Claude Code to show a blank statusline. All commands must redirect stderr.

## Files

| File | Purpose |
|------|---------|
| `statusline.sh` | Main statusline script |
| `obs-status.py` | Pure Python WebSocket client for OBS v5 status (streaming/recording) |

## Cache files

All written to `/tmp/` with `statusline-` prefix:

| File | TTL | Contents |
|------|-----|----------|
| `statusline-badges` | 5s | Pre-rendered ANSI badge strings |
| `statusline-badges-w` | 5s | Visible character widths for wrapping |
| `statusline-git-cache` | 10s | Git branch name |
| `statusline-obs` | 5s | OBS streaming/recording JSON |
| `statusline-tw-*` | session | Terminal width |

## Delamain discovery

The statusline discovers delamains from two sources:

1. **Walk up from cwd** — finds `.claude/delamains/` in the project tree
2. **`.claude/delamain-roots`** — a file listing additional system roots to scan (one path per line). Written by `/run-demo`, removed by `/reset-demo`.
