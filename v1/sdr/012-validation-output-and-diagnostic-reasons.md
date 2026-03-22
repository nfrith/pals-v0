# Validation Output And Diagnostic Reasons

## Status

Accepted

## Context

- Validation output previously had no explicit schema literal.
- Authored ALS source YAML does not carry a top-level `schema` field, so the output contract must remain clearly separate from source syntax.
- Some tests and prospective tooling had to key on diagnostic message text because broad diagnostic codes covered multiple sub-cases.
- ALS evolution and upgrade tooling need a stronger machine-readable contract than author-facing message prose.

## Decision

- System validation output must declare `schema: als-validation-output@1`.
- System validation output must include the active `als_version`, the compiler's supported ALS versions, and the compiler's upgrade model metadata.
- Diagnostics may include a stable optional `reason` string.
- Automation must treat `code` and `reason` as the machine-readable contract.
- Diagnostic `message` remains author-facing text and may change without being the compatibility surface.

## Normative Effect

- Required: Output consumers must not rely on diagnostic `message` text for stable automation.
- Required: New machine-targeted subcases should use stable `reason` values when a broad diagnostic code would otherwise force message parsing.
- Allowed: Diagnostics may omit `reason` when the top-level `code` is already specific enough.
- Rejected: Treating output JSON shape as unversioned.
- Rejected: Treating diagnostic message wording as the machine-readable API.

## Compiler Impact

- Add output schema metadata to `SystemValidationOutput`.
- Add optional `reason` to diagnostics.
- Populate `reason` for ALS-version failures and for broad body/shape validation cases that previously required message matching.

## Docs and Fixture Impact

- Update compiler docs to describe the output contract.
- Update tests to assert `reason` where broad codes are intentionally reused.

## Alternatives Considered

- Creating a unique diagnostic code for every subcase. Rejected because it would fragment the existing code surface more than needed.
- Leaving the output contract unversioned and relying on documentation only. Rejected because upgrade tooling needs a machine-readable anchor.
