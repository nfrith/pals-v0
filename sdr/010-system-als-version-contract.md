# System ALS Version Contract

## Status

Accepted

## Context

- ALS v1 needs one clear version signal for authored source.
- Carrying both top-level source `schema` headers and `als_version` would create a permanent cognitive tax with no current need for independent document-format versioning.
- The intended production model is whole-system ALS-version cutovers, not long-lived mixed ALS versions inside one system.

## Decision

- `.als/system.yaml` must declare `als_version`.
- `als_version` is the active ALS language version for the entire system.
- A system validates against exactly one ALS language version at a time.
- This compiler supports `als_version: 1` only.
- Unsupported `als_version` values are hard validation failures at the system level before module loading begins.
- Authored ALS v1 source YAML does not carry a top-level `schema` field in either `system.yaml` or module shape files.
- Future ALS upgrades may rewrite source document structure as part of whole-system cutover tooling without introducing a separate authored source schema version now.

## Normative Effect

- Required: Every ALS v1 system config must include a positive integer `als_version`.
- Required: Validators must reject unsupported ALS versions explicitly.
- Required: Validators must report the active `als_version` in machine-readable output.
- Allowed: Module schema evolution may continue to use per-module `version` folders within one ALS language version.
- Rejected: Long-lived mixed ALS language versions inside one system.
- Rejected: Carrying a separate authored source `schema` header without an active need for independent source-format versioning.

## Compiler Impact

- `systemConfigSchema` must require `als_version`.
- Source YAML parsing must reject stale top-level `schema` fields in system config and module shape files.
- Validation output must surface the active `als_version` and the compiler's supported ALS versions.
- Unsupported ALS versions must stop validation before module discovery and shape loading.

## Docs and Fixture Impact

- Update the shape-language reference to explain `als_version` as the sole authored source version signal.
- Update example-system fixtures to declare `als_version: 1`.
- Update compiler docs and tests to cover missing and unsupported ALS versions plus rejection of stale source `schema` fields.

## Alternatives Considered

- Keeping a separate authored source `schema` field. Rejected because it adds permanent conceptual overhead without a current product need.
- Allowing mixed ALS versions per module. Rejected because the current intended rollout model is whole-system cutover.
