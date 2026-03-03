# PALS Public Interface Draft 001 (Throwaway)

Status: draft, disposable
Date: 2026-03-02
Purpose: define command intents for the first 4 PALS skills.

## 1) Design Goals

1. Keep public interface stable even if internals change.
2. Prevent uncontrolled agent behavior by making write boundaries explicit.
3. Make every mutating operation two-step: `plan` then `apply`.
4. Support greenfield and brownfield workflows separately.

## 2) Common Skill Protocol

All PALS skills follow this execution contract.

1. `mode`
- `plan`: analyze and return planned operations only (no writes).
- `apply`: execute previously described deterministic operations.

2. `scope`
- Explicit filesystem target(s) for operation.
- Anything outside scope is read-only unless explicitly granted.

3. `result envelope`
- `status`: `ok | blocked | partial | failed`
- `summary`: short human-readable result.
- `artifacts`: files created/updated (or proposed in `plan`).
- `issues`: validation failures, ambiguities, manual decisions required.
- `next_actions`: concrete follow-up actions.

4. Confirmation rule
- `apply` is allowed only after `plan` has been shown to user.

## 3) Skill: `pals-init`

### Intent
Scaffold a new PALS module in a greenfield or partially empty workspace.

### Inputs
- `mode`: `plan | apply`
- `root_path`: workspace root
- `module_path`: target module directory to create
- `module_id`: stable module identifier
- `module_purpose`: plain-language module purpose
- `initial_entities`: optional list (for starter schema)
- `strictness`: `minimal | standard | strict`

### Outputs
- `module_scaffold_plan` (or execution result)
- generated file list (example: `MODULE.md`, schema file(s), starter skill file(s), lint config)
- initial validation report
- unresolved setup questions (if any)

### Write Permissions
- `plan`: no writes
- `apply`: write only under `module_path` and explicitly approved module registration files
- forbidden: edits outside declared scope

## 4) Skill: `pals-adopt`

### Intent
Adopt an existing brownfield directory into PALS compliance.

### Inputs
- `mode`: `plan | apply`
- `target_path`: existing directory to adopt
- `module_id`: optional, inferred if missing
- `adoption_mode`: `audit_only | propose | apply_deterministic`
- `compat_window`: optional version compatibility settings

### Outputs
- `adoption_report` with buckets:
  - `already_compliant`
  - `auto_fixable`
  - `ambiguous_requires_manual`
  - `blocked`
- proposed migration phases
- deterministic patch set for auto-fixable items
- post-change validation result

### Write Permissions
- `audit_only`/`propose`: no writes
- `apply_deterministic`: writes only inside `target_path` and approved PALS metadata files
- forbidden: destructive rewrites without explicit confirmation

## 5) Skill: `pals-evolve`

### Intent
Apply versioned module evolution with explicit compatibility policy.

### Inputs
- `mode`: `plan | apply`
- `module_path`: target module directory
- `evolution_type`: `additive | shape_change | semantic_change`
- `change_spec`: human-language change request + optional structured hints
- `target_schema_version`
- `cutover_policy`: deadlines/severity flips

### Outputs
- `evolution_plan` by phase (`prepare`, `expand`, `backfill`, `cutover`, `cleanup`)
- required linter rule timeline changes
- migrator operations (deterministic + manual queues)
- rollback/stabilization notes

### Write Permissions
- `plan`: no writes
- `apply`: writes to module schema, module metadata, and migration artifacts within `module_path`
- data record rewrites allowed only when operation is deterministic and declared in plan

## 6) Skill: `pals-validate`

### Intent
Run PALS validation only (no orchestration or mutation logic).

### Inputs
- `scope_paths`: file or directory list
- `validation_mode`: `compat | strict`
- `changed_only`: boolean
- `include_codes`: optional lint rule filters
- `exclude_codes`: optional lint rule filters

### Outputs
- machine-readable and human-readable violation report
- per-violation fields: `code`, `severity`, `path`, `reason`, `fix_hint`
- aggregate summary counts and pass/fail decision

### Write Permissions
- no content writes
- optional cache/index writes only under dedicated tool cache directory if enabled

## 7) Permission Tiers (Recommended)

1. Tier 0: Read-only (`pals-validate`, `plan` modes)
2. Tier 1: Scoped scaffold/mutation (`pals-init apply`, parts of `pals-adopt apply_deterministic`)
3. Tier 2: Versioned rewrites (`pals-evolve apply`)

Tier escalation should require explicit user confirmation.

## 8) Non-Goals for This Draft

1. No integration-event architecture in command intents yet.
2. No runtime execution semantics for distributed modules yet.
3. No guarantees about auto-resolving ambiguous brownfield migrations.

## 9) Open Questions

1. Should these be separate installable skills or one skill with 4 strict intents?
2. Should `apply` require plan hash matching to prevent drift between plan and execution?
3. Should `pals-adopt` be allowed to create compatibility aliases automatically, or only propose them?
4. What is the minimal required input for `pals-init` to avoid excessive prompting?
