# PALS Public Interface Draft 002 (Throwaway)

Status: draft, disposable
Date: 2026-03-02
Purpose: slimmer v1 public interface for PALS plugin skills.

## 1) v1 Decisions Applied

1. Distribution model:
- PALS ships as one plugin that includes all PALS skills and subagents.

2. Complexity boundary:
- No plan-hash matching in v1.
- Keep `plan -> apply` flow, but do not enforce hash lock yet.

3. Opinionated posture:
- No `strictness` parameter.
- PALS is opinionated; required entities/structures are not optional knobs.

4. Init philosophy:
- `pals-init` performs domain mapping discovery (DDD-style) from the user's use case.
- User does not need to predefine full entity model.

## 2) Common Protocol (All PALS Skills)

1. Modes:
- `plan`: no writes; produce deterministic operation plan.
- `apply`: execute planned deterministic operations.

2. Scope:
- All operations must declare filesystem scope.
- Writes outside scope are forbidden.

3. Result envelope:
- `status`: `ok | blocked | partial | failed`
- `summary`
- `artifacts`
- `issues`
- `next_actions`

4. Safety:
- No destructive rewrite without explicit user confirmation.

## 3) Skill Intents

### 3.1 `pals-init`

Intent:
- Create a new PALS module from user intent, including domain mapping and initial module structure.

Inputs:
- `mode`: `plan | apply`
- `root_path`
- `module_path`
- `module_name`
- `use_case_prompt` (natural language)

Outputs:
- domain map summary (candidate entities, boundaries, relationships)
- proposed module scaffold plan
- generated files (on apply)
- unresolved decisions requiring user input
- initial validation report

Write permissions:
- `plan`: no writes
- `apply`: write only under `module_path` plus explicitly approved registration files

### 3.2 `pals-adopt`

Intent:
- Convert an existing brownfield directory into PALS-compliant module shape.

Inputs:
- `mode`: `plan | apply`
- `target_path`
- `adoption_mode`: `audit_only | propose | apply_deterministic`

Outputs:
- adoption report buckets:
  - `already_compliant`
  - `auto_fixable`
  - `ambiguous_requires_manual`
  - `blocked`
- proposed phase plan
- deterministic patch set (for auto-fixable)
- validation report

Write permissions:
- `audit_only`/`propose`: no writes
- `apply_deterministic`: writes only inside `target_path` and approved PALS metadata files

### 3.3 `pals-evolve`

Intent:
- Run versioned module evolution (`additive`, `shape_change`, `semantic_change`).

Inputs:
- `mode`: `plan | apply`
- `module_path`
- `evolution_type`: `additive | shape_change | semantic_change`
- `change_spec` (natural language + optional structured hints)
- `target_schema_version`

Outputs:
- phased evolution plan (`prepare`, `expand`, `backfill`, `cutover`, `cleanup`)
- linter severity timeline changes
- deterministic migration operations
- manual queue items
- validation report

Write permissions:
- `plan`: no writes
- `apply`: writes only within `module_path` and declared migration artifacts

### 3.4 `pals-validate`

Intent:
- Validate compliance and evolution constraints with no data mutation.

Inputs:
- `scope_paths`
- `validation_mode`: `compat | strict`
- `changed_only`: boolean

Outputs:
- violation report (`code`, `severity`, `path`, `reason`, `fix_hint`)
- summary counts + pass/fail

Write permissions:
- no content writes

## 4) Permission Tiers

1. Tier 0 (read-only): `pals-validate`, all `plan` modes
2. Tier 1 (scoped writes): `pals-init apply`, `pals-adopt apply_deterministic`
3. Tier 2 (versioned rewrites): `pals-evolve apply`

## 5) Alias Clarification (for `pals-adopt` / `pals-evolve`)

Alias means temporary compatibility mapping from old shape to new canonical shape.

Examples:
1. Section alias (body):
- old: `## Media`
- new: `## Assets` -> `### Media`
- canonical key: `body.media`

2. Field alias (frontmatter):
- old: `epic`
- new: `epic_ref`
- temporary map allows reads while migration is in progress.

Rules:
1. Aliases are temporary, not permanent API.
2. Aliases exist only during compatibility windows.
3. Alias removal is required at cutover/cleanup.

## 6) Open Questions (Reduced)

1. Should plugin expose one command namespace (`/pals ...`) or separate skill entrypoints?
2. What is the minimum operator confirmation UX before `apply` in each harness?
