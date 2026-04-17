# System Module Descriptions

## Status

Accepted

## Context

- Scanners such as `/install-reference` need one human-readable summary per module when presenting choices to an operator.
- Existing `.als/system.ts` module declarations only carry `path`, `version`, and `skills`, which are implementation metadata rather than an operator-facing description.
- The authoritative location for this metadata is the system-level module declaration in `defineSystem(...)`, not `defineModule(...)`.
- Operator direction for this decision is explicit: every module description is required, trimmed, single-line, capped at 120 characters, and validated with a targeted error that names the offending module.

## Decision

- Every `.als/system.ts` module entry must declare `description`.
- `description` is system-level registration metadata. `defineModule(...)` remains unchanged.
- `description` must be a string that is non-empty after trimming, has no leading or trailing whitespace, stays on one line, and is 120 characters or fewer.
- Validators must reject missing descriptions. ALS does not infer defaults from the module id, path, or skill list.
- Validation failures for module descriptions must name the offending module and surface the 120-character cap directly in the diagnostic message.
- Content guidance is editorial rather than syntactic: descriptions should explain what the module is for, not repeat the module id/path or dump skill/version metadata.

## Normative Effect

- Required: every `defineSystem({ modules: { ... } })` entry includes `description`.
- Required: description validation rejects missing, blank, whitespace-padded, multiline, and overlong values.
- Required: validators emit module-specific diagnostics for invalid descriptions.
- Allowed: different systems may choose different wording for the same module shape so long as the authored description stays accurate and within the validation contract.
- Allowed: scanner and authoring surfaces to read descriptions directly from `.als/system.ts`.
- Rejected: optional descriptions.
- Rejected: defaulting or inferring descriptions from module ids, paths, or skill arrays.
- Rejected: moving the description requirement into `defineModule(...)` for this change.

## Compiler Impact

- Extend `systemConfigSchema` so module declarations require `description` and enforce the trim, single-line, and 120-character rules.
- Preserve the existing system-level diagnostic shape while customizing module-description error messages to include the module id and cap.
- Add positive and negative compiler coverage for valid module descriptions and invalid missing/blank/trimmed/multiline/overlong cases.
- Keep downstream projection behavior unchanged except where consumers already read module metadata directly from `system.ts`.

## Docs and Fixture Impact

- Update the canonical shape-language reference to document `modules.{module_id}.description`.
- Update authored examples that show `system.ts` module registration so they include descriptions.
- Update `/install-reference` guidance to treat descriptions as required and to surface them directly in picker options.
- Migrate in-repo systems by adding real descriptions to `reference-system/.als/system.ts` and the Ghost root `.als/system.ts`.
- Record the hard-break migration in the changelog and point operators here for the new contract.

## Alternatives Considered

- Making module descriptions optional. Rejected because optional discovery metadata rots and reintroduces inference hacks in scanners.
- Storing descriptions in `defineModule(...)`. Rejected because the operator-facing choice is about mounted module registration, not module structure.
- Auto-generating placeholder descriptions during migration. Rejected because operator direction explicitly requires a hard break with authored descriptions, not placeholders.
- Allowing multiline or whitespace-normalized descriptions. Rejected because scanners need predictable one-line option text and authored source should remain explicit.
