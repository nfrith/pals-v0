# ALS v1 Compiler Production-Evolution Risks

1. `moduleFilter` is not a production-safe partial-validation mode. `validateSystem()` builds `recordIndex` only from `selectedModuleIds`, then resolves refs against that reduced set, so filtered runs can turn valid cross-module refs into false `REF_UNRESOLVED` failures.
   Refs: `v1/alsc/compiler/src/validate.ts:121`, `v1/alsc/compiler/src/validate.ts:134`, `v1/alsc/compiler/src/validate.ts:1073`, `v1/alsc/compiler/README.md:16`, `v1/alsc/compiler/test/system-negative.test.ts:131`.
   This makes staged rollout validation unreliable.
   Recommendation A: make filtered validation load the full dependency/reference index while only reporting diagnostics for the selected module(s).
   Recommendation B: if filtered runs are intentionally weaker, split them into an explicitly different mode such as local-only or syntax-only validation.

2. Module versioning is a big-bang cutover model with no compatibility window. The language exposes one active `version` per module in `system.yaml`, and the compiler always infers exactly one live shape file from it.
   Refs: `v1/alsc/compiler/src/schema.ts:530`, `v1/alsc/compiler/src/validate.ts:195`, `v1/alsc/compiler/src/validate.ts:1371`, `v1/alsc/compiler/README.md:7`, `v1/example-systems/centralized-metadata-happy-path/README.md:20`.
   In production, any breaking shape change becomes an atomic subtree rewrite: old and new record contracts cannot coexist, and the compiler offers no migration-mode semantics.
   Recommendation A: define an explicit compatibility model now, such as current-version-only with required atomic rewrites, or bounded N/N+1 coexistence during rollout.
   Recommendation B: add validator support for migration windows if coexistence is intended, instead of leaving version numbers as storage labels with no operational meaning.

3. Cross-module references have no backward-compatibility or rename story. ALS refs are versionless `als://system/module/...` URIs, and canonical identities are emitted from the same versionless text surface. Field targets also name only `module` and `entity`, while dependency validation checks only that the module is declared, not that the target entity exists in the dependency's active shape or remains compatible over time.
   Refs: `v1/alsc/compiler/src/refs.ts:16`, `v1/alsc/compiler/src/validate.ts:1181`, `v1/alsc/compiler/src/schema.ts:122`, `v1/alsc/compiler/src/schema.ts:164`, `v1/alsc/compiler/src/validate.ts:1246`.
   That means renaming `system_id`, `module_id`, or entity names is a hard break, and downstream compatibility failures degrade late into unresolved-ref behavior.
   Recommendation A: either declare `system_id`, `module_id`, and entity names immutable public API once published.
   Recommendation B: or introduce alias/version indirection for refs and cross-module targets before production adoption.

4. Entity path-template semantics are identity-critical but under-specified and under-validated. The schema only requires a non-empty path containing `{id}`. The path parser treats arbitrary placeholder names as binding keys, while canonical URI construction later assumes those bindings line up with lineage entity names.
   Refs: `v1/alsc/compiler/src/schema.ts:348`, `v1/alsc/compiler/src/schema.ts:380`, `v1/alsc/compiler/src/parser/path-template.ts:18`, `v1/alsc/compiler/src/validate.ts:1192`.
   In production, a seemingly harmless path-template rename can silently stop canonical identity construction, duplicate detection, and parent-prefix checks instead of producing a crisp migration diagnostic.
   Recommendation A: define placeholder semantics normatively and validate them at shape-load time, especially parent-lineage placeholders.
   Recommendation B: or stop deriving identity from placeholder-name conventions and require explicit parent-id sourcing in the entity contract.

5. The diagnostic contract is too coarse for long-term rollout tooling. Many materially different failures collapse into umbrella codes such as `SHAPE_INVALID` and `BODY_CONSTRAINT_VIOLATION`. The test suite already compensates by asserting message fragments for distinct cases.
   Refs: `v1/alsc/compiler/src/diagnostics.ts:9`, `v1/alsc/compiler/src/diagnostics.ts:12`, `v1/alsc/compiler/src/validate.ts:499`, `v1/alsc/compiler/src/markdown.ts:220`, `v1/alsc/compiler/test/body-contract-negative.test.ts:25`, `v1/alsc/compiler/test/body-contract-negative.test.ts:40`, `v1/alsc/compiler/test/body-contract-negative.test.ts:158`.
   In production, operators will do the same, which will make wording changes de facto breaking changes.
   Recommendation A: introduce stable machine-readable subreasons before external tooling has to parse `message`.
   Recommendation B: if broad codes are intentional, explicitly declare message text unstable and add structured payload fields whose compatibility is versioned.

All 119 current tests pass. These findings are about production evolution traps, not about the current suite being red.
