---
name: install-reference
description: Install pre-built modules from the ALS plugin's bundled reference system. Lets the operator pick one or many modules, copies them into the current project, validates, and auto-deploys the Claude projection. Re-runnable any time — not an onboarding-only flow.
allowed-tools: AskUserQuestion, Bash(bash *), Read, Write, Edit
---

# install-reference

Import pre-built modules from a reference system (bundled with the ALS plugin) into the operator's current project. The operator picks from a live scan — reference systems can be added, removed, or revised in the plugin, and this skill discovers them dynamically.

This skill is a peer to `/new` (which authors a module from scratch). Use this one when the operator wants something ready-made. Do not duplicate `/new`'s authoring logic here — if the operator wants to create from scratch, hand off to `/new` and exit.

## Inputs

- "install a reference"
- "install pre-built modules"
- "bring in the ghost-factory loop" (or any module name from a reference system)

## Phase 0 — Prereqs

Same form as `/install` Phase 1:

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
if [ -d "$PLUGIN_ROOT" ] && [ -f "$PLUGIN_ROOT/alsc/compiler/src/cli.ts" ]; then
  printf 'PLUGIN_ROOT=%s\n' "$PLUGIN_ROOT"
else
  echo "PLUGIN_ROOT_INVALID: $PLUGIN_ROOT"
fi
```

If `PLUGIN_ROOT_INVALID`, stop. See [`skills/CLAUDE.md`](../CLAUDE.md) for the plugin-root resolution rule.

Then confirm the current project is an ALS system:

```bash
[ -f .als/system.ts ] && echo "SYSTEM: present" || echo "SYSTEM: missing"
```

If `SYSTEM: missing`, tell the operator: "This project isn't an ALS system yet. Run `/install` first to bootstrap." Do not attempt to bootstrap from a reference — that's a separate flow and pulling a 7-module reference into nothing is not a sane default.

## Phase 1 — Resolve the reference system

There is exactly one reference system bundled with this plugin: `${CLAUDE_PLUGIN_ROOT}/reference-system`. This skill does not scan, does not offer a picker, and does not support variants. Use the canonical path directly:

```bash
REFERENCE_ROOT="${CLAUDE_PLUGIN_ROOT}/reference-system"
if [ -f "$REFERENCE_ROOT/.als/system.ts" ]; then
  printf 'REFERENCE_ROOT=%s\n' "$REFERENCE_ROOT"
else
  echo "REFERENCE_MISSING: $REFERENCE_ROOT"
fi
```

If the manifest is missing, stop and tell the operator the plugin is malformed. Do not fall back to other paths or search elsewhere — the reference system's location is part of the plugin contract.

## Phase 2 — Enumerate modules

Read the chosen reference system's `.als/system.ts` and extract the `modules` object. For each module record:

- module id (the key)
- `path`
- `version`
- `skills` array
- **`description`** when present (see [`als-factory/jobs/ALS-006.md`](../../../als-factory/jobs/ALS-006.md) — until that job ships, the field is not yet in the schema. Present whatever is there; fall back to an empty description and render the option with `path`, `version`, `skills count` only.)

## Phase 3 — Select modules

When the reference system declares **13 or fewer modules**, present them all in a single AskUserQuestion call using the layout below. AskUserQuestion caps at 16 option slots per call and meta-options (`[ALL]` + `[CANCEL]`) consume 2 — so 13 is the largest module count that fits without paging.

When the reference system has **14 or more modules**, fall back to paged rounds (see [Paged fallback](#paged-fallback-14-modules) below).

The 13-module threshold is a **display constraint of this skill**, not an ALS language rule. An ALS system can declare any number of modules — this skill just prefers a tighter picker UX when the module count allows it.

### Single-call layout (≤13 modules)

**Layout rules:**

- `[ALL]` is always the first option of **Q1** and carries `(Recommended)`.
- Modules pack in stable alphabetical order across Q1–Q_last, 4 options per question.
- `[CANCEL]` is always the last explicit option of **Q_last**.
- `[Other]` is auto-added by the tool as the final option of every question — never include it explicitly.
- Every question uses `multiSelect: true`.

**Example layout for a 13-module reference system:**

| Q | Header | Options |
|---|--------|---------|
| Q1 | `Scope` | `[ALL] (Recommended)`, mod 1, mod 2, mod 3 |
| Q2 | `Modules 2` | mod 4, mod 5, mod 6, mod 7 |
| Q3 | `Modules 3` | mod 8, mod 9, mod 10, mod 11 |
| Q4 | `Modules 4` | mod 12, mod 13, `[CANCEL]` |

For smaller systems, collapse into fewer questions while keeping the same rules. Minimum per question is 2 — if the tail would be 0 or 1 options, shift meta-options up to the previous question.

**Option metadata:**

- label = module id
- description = `<description if present, else "—">. <path>, v<version>, <N> skill(s)`

**Answer handling:**

- If `[ALL]` is checked → candidate list = every module. Ignore other module checks.
- If `[CANCEL]` is checked → exit with no changes.
- Otherwise → candidate list = union of module checks across all questions.
- If `[Other]` was used → interpret the typed instruction. Common shapes: "everything except X", "install X Y Z", "cancel."

If the candidate list ends up empty, exit with no changes.

### Paged fallback (14+ modules)

Triggered only when the reference system has more modules than the single-call layout can hold. Shape:

1. **Scope call** — one AskUserQuestion, single-select, header `Scope`. Options: `[ALL] (Recommended)`, `Pick specific`, `[CANCEL]`.
   - `[ALL]` → candidate list = every module. Skip to Phase 4.
   - `[CANCEL]` → exit with no changes.
   - `Pick specific` → continue to the paged picker.
2. **Paged picker** — subsequent AskUserQuestion calls, `multiSelect: true`, up to 4 questions per call × 4 options per question. Pack modules alphabetically until exhausted. Each question's header reflects the page (`Modules 1`, `Modules 2`, ...).
3. Take the union of all checks across every page. If the set is empty, exit with no changes. Otherwise confirm the list back to the operator in a one-line message before Phase 4.

## Phase 4 — Conflict check

For each candidate module, check the target project for collisions: module id, mount-path overlap, or skill-id collision against anything already registered in the target `.als/system.ts`.

If a candidate collides, **rename the incoming module** to a non-colliding id, update the copied bundle accordingly, and use the new id when registering in Phase 5. No operator prompt — the rename is a trivial mechanical task.

Only escalate to the operator if the rename can't be resolved obviously (e.g. the renamed id would still overlap something else).

## Phase 5 — Copy and register

For each surviving candidate, in order:

1. Copy the module's ALS bundle only — the authored definition under `.als/modules/{module_id}`. **Do not copy the module's mounted data directory** from the reference system (e.g. `workspace/factory/items/*.md`, `clients/registry/clients/*.md`, or whatever sits under the module's `path`). That data is reference-system exemplar content, not something the operator wants imported into their project.

   ```bash
   cp -R "${REFERENCE_ROOT}/.als/modules/{module_id}" ".als/modules/{module_id}"
   ```

2. Create an empty mounted data directory at the module's `path` so the compiler and skills can project into it:

   ```bash
   mkdir -p "{module.path}"
   ```

3. Append the module's entry to the target `.als/system.ts`'s `modules: {}` block. Use Edit to insert a new key immediately before the closing `}` of the modules record. Preserve indentation. Copy the reference system's fields verbatim (`path`, `version`, `skills`, and `description` if present). If the module was renamed in Phase 4, use the new id as the key and keep the renamed id consistent across the copied bundle and this entry.

Do this per-module so a failure mid-way is easy to surface and partial state is visible.

## Phase 6 — Validate

```bash
bun ${CLAUDE_PLUGIN_ROOT}/alsc/compiler/src/cli.ts validate .
```

If validation fails, surface the full compiler output to the operator without trying to auto-fix. Tell them: "The installed modules are on disk but the system did not validate. Resolve the errors or run `/install-reference` again after undoing the copy. Nothing was deployed to `.claude/`." Stop — do not proceed to Phase 7.

## Phase 7 — Deploy

Validation passed. Dry-run the Claude projection, then live-deploy:

```bash
bun ${CLAUDE_PLUGIN_ROOT}/alsc/compiler/src/cli.ts deploy claude --dry-run .
bun ${CLAUDE_PLUGIN_ROOT}/alsc/compiler/src/cli.ts deploy claude .
```

If the dry-run surfaces target collisions, stop and report them — do not push through. If the live deploy fails, report the full compiler output. Otherwise the installed modules' skills, delamains, and projections are now live under `.claude/`.

The operator does not request this step. New modules are useless until projected — auto-deploy is the default.

## Phase 8 — Report

One block, no ceremony:

- Reference system: `reference-system` at `${CLAUDE_PLUGIN_ROOT}/reference-system`
- Installed: `<module_id_1>, <module_id_2>, ...`
- Skipped (conflicts): `<module_id>: <reason>` (one per line, or "none")
- Validation: `pass`
- Deploy: `pass` (or the error summary if it failed)
- Next: installed skills and delamains are live under `.claude/`. Invoke them directly.

## Notes

- **13-module threshold is a skill-only display constraint.** AskUserQuestion allows at most 16 option slots per call; the single-call picker needs 2 for `[ALL]` + `[CANCEL]`, leaving 13 for modules. This is **not** an ALS language rule — ALS systems can declare any number of modules. When a reference system has 14+ modules, this skill silently falls back to paged rounds (see Phase 3). No schema enforcement, no compiler change.
- **Descriptions**: See [`ALS-006`](../../../als-factory/jobs/ALS-006.md). Until that job ships, option descriptions in Phase 3 fall back to path/version/skill count. After it ships, every module in a reference system will carry a human-readable description at the declaration site and this skill will surface it directly.
- **Scope**: copy + register + validate + deploy. Not module authoring. If the operator wants a new module from scratch, hand off to `/new`.
- **Re-runnable**: running this skill again after an earlier install just adds more modules. Existing modules already in the target get renamed on the incoming copy (Phase 4).
- **No versioning story yet**: this skill installs at the version declared in the reference system. There is no "upgrade this reference module" flow. When that becomes a need, it gets its own job.
