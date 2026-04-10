---
name: bootup
description: Boot an ALS system — start delamain dispatchers and runtime services using operator-configured preferences or interactive setup.
allowed-tools: Bash(bash *)
---

# bootup

Boot an ALS system's runtime services. Reads the operator's boot configuration if one exists, otherwise guides interactive setup.

For the `.als/config.md` format specification, see [`../docs/references/bootup-config.md`](../docs/references/bootup-config.md).

## Scan results

<bash>bash ${CLAUDE_PLUGIN_ROOT}/skills/bootup/scan.sh</bash>

## Procedure

### Step 1 — Check for boot configuration

Parse the scan results above.

**If `CONFIG: found`:**
- Read the `Operator's Preferences` section from the scan output
- These are the operator's instructions for how to start delamains
- Proceed to Step 2 using those instructions

**If `CONFIG: none`:**
- No boot configuration exists yet
- Present the setup survey (Step 3) to create one

### Step 2 — Start offline delamains per operator preferences

If the scan shows `All dispatchers are running. Nothing to do.` — report this and exit.

Otherwise, for each delamain listed in `OFFLINE_DELAMAINS`:

1. Read the operator's preferences to determine HOW to start the dispatcher
2. Execute the start commands accordingly (e.g., create tmux windows, run background shells, etc.)
3. Ensure `bun install` has been run in the dispatcher directory before starting
4. Start all offline dispatchers in parallel when possible

After starting, verify with:

```bash
sleep 3 && for sf in {system-root}/.claude/delamains/*/status.json; do [ -f "$sf" ] && echo "=== $(jq -r .name "$sf") ===" && jq '{name, pid, items_scanned, active_dispatches}' "$sf"; done
```

Report results to the operator in a single table.

### Step 3 — Interactive setup (no config.md)

Present the operator with a setup survey using AskUserQuestion:

**Header**: `Boot Config`

**Question**: "How would you like delamains to be started?"

**Options**:
1. **Choose best for me & make custom config** (Recommended) — Inspect the runtime environment (terminal multiplexer, shell, process manager) and generate a `.als/config.md` with sensible defaults. Then boot.
2. **Run a custom config** — Look for existing `.als/config.md` files. If exactly one exists, use it. If multiple exist (future: config variants), ask which one to use.
3. **Make a custom config** — Walk the operator through creating `.als/config.md` interactively, then boot.

#### Option 1: Choose best for me

1. Detect the runtime environment:
   - Is a terminal multiplexer running? (tmux, zellij, screen)
   - Are there custom tmux sockets or sessions? (e.g., named sessions for workspace management)
   - What shell is the operator using?
   - Is there an existing window/pane management convention?
2. Generate `.als/config.md` with detected preferences:
   - If terminal multiplexer detected: use dedicated windows/panes with `{module}-delamain-{name}` naming
   - If no multiplexer: use Claude background shells (legacy behavior)
3. Show the generated config to the operator for confirmation
4. Write `.als/config.md` and proceed to Step 2

#### Option 2: Run a custom config

1. Check if `.als/config.md` exists
2. If it exists, read it and proceed to Step 2
3. If it doesn't exist, tell the operator no config was found and offer Option 1 or 3

#### Option 3: Make a custom config

1. Ask the operator how they want delamains started (AskUserQuestion with environment-specific options)
2. Ask about naming conventions
3. Generate `.als/config.md` from their answers
4. Show it for confirmation, write it, and proceed to Step 2

## Notes

- This skill replaces the former `/run-delamains`
- When Claude exits, dispatchers started as Claude background shells die. Dispatchers started in tmux windows survive.
- If all dispatchers are already running, nothing to do.
- The boot configuration is operator-local — it is not managed by `/change` or `/migrate`.
