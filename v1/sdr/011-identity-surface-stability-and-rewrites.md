# Identity Surface Stability And Rewrites

## Status

Accepted

## Context

- ALS canonical refs and inferred identities already depend on `system_id`, module ids, entity names, section names, and path-template placeholders.
- Those surfaces were acting like public API without an explicit decision recording that fact.
- The intended production model allows upgrade tooling to rewrite systems, but ALS v1 itself does not provide runtime aliasing or mixed-version identity semantics.

## Decision

- In ALS v1, the following are identity-significant public surfaces once published: `system_id`, module ids, entity names, section names, and path-template placeholder names used for lineage bindings.
- ALS v1 does not define aliasing, redirects, or compatibility indirection for those surfaces.
- Changing those surfaces is a breaking change unless upgrade tooling rewrites all affected records and shapes as part of a whole-system cutover.
- Upgrade tooling may classify such rewrites as mechanical when the rewrite is deterministic and meaning-preserving.
- Upgrade tooling may classify such rewrites as semantic-assisted when a rewrite changes meaning or requires operator review.

## Normative Effect

- Required: Validators and docs must treat canonical refs and lineage-derived identities as load-bearing.
- Required: Identity rewrites must happen outside the runtime validation contract, through explicit upgrade tooling.
- Allowed: Whole-system upgrades may rewrite published identity surfaces if every affected artifact is updated consistently.
- Rejected: Implicit alias behavior.
- Rejected: Partial rename semantics where old and new identity surfaces both remain valid under ALS v1 without an external rewrite pass.

## Compiler Impact

- No new alias-resolution behavior is added to the v1 validator.
- Compiler and upgrade tooling must keep exposing the current identity-sensitive behavior clearly enough for deterministic rewrites and explicit stop points.

## Docs and Fixture Impact

- Record the stability rule in SDRs and reference docs so later migration tooling is designed around explicit rewrites, not hidden compatibility behavior.
- Keep examples and diagnostics aligned with the fact that canonical refs remain versionless in ALS v1.

## Alternatives Considered

- Adding runtime alias/redirect semantics in ALS v1. Rejected because it expands the lifecycle model substantially and is outside the chosen cutover approach.
- Treating names and placeholders as purely cosmetic. Rejected because current canonical identity construction already depends on them.
