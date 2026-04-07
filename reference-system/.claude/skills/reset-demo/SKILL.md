---
name: reset-demo
description: Reset the reference-system to its pre-demo state. Removes fabricated items and restores modified records to their committed versions.
model: sonnet
allowed-tools: Bash(bash *), Read, Glob
---

# reset-demo

Reset the reference-system back to its natural resting state — as if `/run-demo` was never invoked.

## What it undoes

- **Fabricated items** created by the run-demo traffic generator are deleted
- **Modified records** that dispatchers acted on are restored to their committed state
- **Dispatcher status files** are cleaned up

## Procedure

### 1. Stop dispatchers

Kill any running delamain dispatchers so they don't interfere with the reset:

```bash
for sf in {system-root}/.claude/delamains/*/status.json; do
  [ -f "$sf" ] && pid=$(jq -r .pid "$sf") && kill "$pid" 2>/dev/null && rm -f "$sf"
done
```

If no status.json files exist, dispatchers are already stopped.

### 2. Remove fabricated items

The run-demo traffic generator creates new `.md` files in module data directories. These are untracked by git. Remove them:

```bash
cd {system-root} && git clean -f \
  workspace/factory/items/ \
  workspace/incident-response/reports/ \
  workspace/experiments/ \
  operations/postmortems/ \
  infra/
```

This only deletes untracked files (fabricated items). Committed files are untouched.

### 3. Restore modified records

Dispatchers may have advanced existing records to different states. Restore them to their committed versions:

```bash
cd {system-root} && git checkout -- \
  workspace/factory/items/ \
  workspace/incident-response/reports/ \
  workspace/experiments/ \
  operations/postmortems/ \
  infra/
```

### 4. Clean up dispatcher artifacts

Remove any leftover status files and runtime manifests that aren't gitignored:

```bash
rm -f {system-root}/.claude/delamains/*/status.json
```

### 5. Report

Tell the operator:
- How many fabricated items were removed (count from `git clean` output)
- How many records were restored (count from `git checkout` output)
- That dispatchers were stopped
- The reference-system is ready for a fresh `/run-demo`

## Notes

- This skill is safe to run multiple times — it is idempotent.
- It does NOT modify `.als/` module definitions, shapes, or delamain bundles.
- It does NOT uninstall `node_modules/` in dispatcher directories.
- After reset, run `/run-demo` to start a fresh demo cycle.
