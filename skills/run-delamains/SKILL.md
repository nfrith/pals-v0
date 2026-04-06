---
name: run-delamains
description: Start Delamain dispatchers for the current ALS system as background shells. Run at session start to activate SDLC pipelines.
allowed-tools: Bash(bash *)
---

# run-delamains

Start offline Delamain dispatchers as Claude-managed background shells.

## Current status

!`bash ${CLAUDE_PLUGIN_ROOT}/skills/run-delamains/scan.sh`

## Procedure

1. Start each offline dispatcher using `Bash` with `run_in_background: true`. Use the exact commands from the Start commands section. Launch all of them in parallel (one Bash call per dispatcher, all in a single message).

2. After starting all dispatchers, run ONE verify command that checks all of them at once:

```bash
sleep 3 && for sf in {system-root}/.claude/delamains/*/status.json; do [ -f "$sf" ] && echo "=== $(jq -r .name "$sf") ===" && jq '{name, pid, items_scanned, active_dispatches}' "$sf"; done
```

3. Report results to the operator in a single table.

## Notes

- Dispatchers run as Claude background shells — visible as "N shell", inspectable via Shell details.
- When Claude exits, dispatchers die. Run `/als:run-delamains` again on the next session.
- If all dispatchers are already running, nothing to do.
