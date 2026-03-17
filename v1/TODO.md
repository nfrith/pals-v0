# v1 TODO

## 1. Explicit Declaration Semantics for Fields and Sections

### Context

The current compiler treats presence and nullability as separate concerns:

- `required` controls whether a frontmatter field or body section must appear in the record.
- `allow_null` controls whether an explicitly present field/section may use `null`.

That is not the intended PALS design for agent-first systems.

The intended rule is stricter:

- Every declared field must be explicitly present in frontmatter.
- Every declared section must be explicitly present in the markdown body.
- `allow_null` means the explicit value may be `null`; it does not mean the field or section may be omitted.

This matters because omission creates shape ambiguity for agents. The system should expose a stable explicit record shape even when a value is empty.

This future change also subsumes the current review feedback around optional section ordering. Under the intended semantics, there should be no concept of a declared section that may be silently omitted.

### Why this is deferred

This is a semantic contract change, not just a bug fix.

It affects:

- frontmatter validation
- body validation
- examples and fixtures
- language documentation
- possibly the meaning or existence of `required`

Because of that, it should be handled as a dedicated follow-up after the current review-fix session.

### Desired end state

The compiler should enforce:

- all declared root/base fields are present
- all declared variant-local fields for the selected variant are present
- all declared plain-entity sections are present
- all declared variant sections for the selected variant are present
- nullable fields may use YAML `null`
- nullable sections may use the literal body content `null`

The compiler should reject:

- omitted declared fields
- omitted declared sections
- empty sections used in place of explicit `null`
- records that rely on omission to signal “not applicable” or “not filled in yet”

### Likely implementation areas

- `v1/palsc/compiler/src/validate.ts`
- `v1/palsc/compiler/src/schema.ts`
- `v1/palsc/skills/new/references/shape-language.md`
- `v1/example-systems/centralized-metadata-happy-path/`
- compiler negative tests for frontmatter and body validation

### Open questions

1. What should happen to `required`?

Current state:

- `required` is the presence flag.

Under the intended semantics:

- `required` becomes redundant for fields and sections.

Decision:

- `required` should be removed.

Recommendation:

- remove it from the authoring model for fields, inline sections, and variant `section_definitions`
- declared membership should control presence, specifically:
  - a declared field must appear in frontmatter
  - a plain-entity section listed in `sections` must appear in the body
  - a variant section named in `variants.<name>.sections` must appear in the body for that variant
- if a compatibility bridge is needed during transition, only tolerate `required: true` as a deprecated no-op
- reject `required: false` rather than preserving it, because it encodes the old omission-based model

2. Should “explicit declaration” mean explicit `null` for list/ref/string/number/date/enum whenever `allow_null: true`?

Decision:

- yes

Applies uniformly to:

- string
- number
- date
- enum
- ref
- list
- body sections

3. Should variant resolution failure still validate body shape?

Today:

- bad discriminator values can cause effective section validation to be skipped

Recommendation:

- do not silently skip body validation when the discriminator is missing, malformed, or invalid
- do not attempt union/intersection guessing across variant section sets
- instead emit an explicit body-side failure stating that the variant-specific body contract could not be resolved, so the record cannot pass while section validation is unresolved
- give that body-side failure its own diagnostic code, distinct from missing-section, unknown-section, or order-mismatch errors
- when that unresolved-body diagnostic is present, suppress downstream section diagnostics for that record until the discriminator is fixed

This preserves strictness without inventing a body contract the shape did not declare.

4. How should “not applicable for this type” be represented?

Recommendation:

- the only intended mechanism is variant selection or a separate entity shape
- if a field/section is not applicable for one type, it should not be declared for that type
- `null` should mean “this declared slot exists but currently has no value/content”, not “this concept does not apply to this type”

5. Do we want to preserve `required: false` in examples during transition, or normalize examples now so all declared members are explicitly present with `null` when empty?

Recommendation:

- update canonical examples and fixtures in the same pass as the compiler/doc semantic change so the snapshot stays internally consistent
- in that pass, ensure all declared nullable members appear explicitly with `null` when empty
- remove `required: false` from examples instead of keeping transition-era mixed semantics in the main docs
- if migration examples are needed, keep them isolated in compatibility notes or tests rather than in the primary reference material

### Additional recommendations discovered during compiler/doc review

1. Add an explicit body diagnostic for unresolved variants.

Current compiler behavior can emit `PAL-RV-FM-008` and return `sections: null`, which means body validation is effectively skipped. The future contract should produce an explicit record-body failure with its own code as well, so records never appear to have a valid body when variant resolution failed.

2. Suppress redundant body-order diagnostics when the section set is already invalid.

If a section is missing, unknown, or variant resolution failed, `BODY_ORDER_MISMATCH` becomes secondary noise. For agent-facing repair loops, it is better to report missing/unknown/unresolved first and reserve order diagnostics for cases where the declared section set is otherwise complete.

3. Clarify `null` vs empty-value semantics in the language docs.

The future contract already rejects empty body sections. A similar clarification is worth making for frontmatter:

- `null` means explicit absence within a declared slot
- `[]` means an explicitly empty list, not the same thing as `null`
- string fields should preferably avoid using empty string as a stand-in for `null`

If the project wants the strictest possible contract, rejecting empty strings for ordinary `string` fields is worth considering in the same cleanup pass or immediately after it.

4. Treat docs/examples/tests as part of the same semantic migration.

This change is not isolated to record validation. The same pass should update:

- `schema.ts`
- `validate.ts`
- `markdown.ts` diagnostics/behavior as needed
- shape-language reference text
- example systems
- negative tests that currently construct `required: false` shapes or rely on omission-era behavior
- diagnostic codes/messages so unresolved discriminator state and unresolved body-contract state are distinct

### Acceptance criteria for the future session

- The compiler rejects omitted declared fields even when `allow_null: true`.
- The compiler rejects omitted declared sections even when `allow_null: true`.
- The compiler accepts explicit `null` only where `allow_null: true`.
- Variant entities enforce explicit presence for the selected variant’s fields and sections.
- Docs clearly state that omission is not allowed for declared members.
- Example systems and fixtures reflect the explicit-declaration rule.
