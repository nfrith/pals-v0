# Record Body Markdown Rejection Semantics

## Status

Accepted

## Context

- SDRs 006 through 008 define ALS v1 record-body outline semantics and the supported body block model.
- Those SDRs do not explicitly settle how ALS v1 handles several mdast nodes that the parser can emit today:
  - `definition`
  - `linkReference`
  - `imageReference`
  - flow `html`
  - inline `html`
  - `thematicBreak`
- Before this SDR, compiler behavior was inconsistent across that surface:
  - `definition`, flow `html`, and `thematicBreak` were rejected only through the generic unsupported-block path
  - inline `html` passed implicitly because phrasing nodes were not validated explicitly
- ALS v1 needs an explicit, teachable markdown subset so the compiler, docs, and tests can agree on what is intentionally rejected.

## Decision

- ALS v1 record bodies use a curated markdown subset, not full mdast coverage.
- The supported body block model remains the one established by SDRs 006 through 008:
  - `paragraph`
  - `bullet_list`
  - `ordered_list`
  - `table`
  - `heading`
  - `blockquote`
  - `code`
  - `outline`
  - top-level `title`, `preamble`, and ordered `sections`
- Phrasing-level validation in current v1 is only partial.
- The compiler intentionally rejects raw HTML and reference-style syntax, but it does not exhaustively validate every other inline node.
- Authored records in current v1 currently use this practical inline markdown subset:
  - `text`
  - `strong`
  - `emphasis`
  - `inlineCode`
  - inline `link`
  - inline `image`
  - `break`
- ALS v1 rejects raw HTML anywhere in record bodies.
- ALS v1 rejects both flow `html` and inline `html`.
- ALS v1 rejects reference-style links and reference-style images.
- ALS v1 rejects markdown `definition` nodes anywhere in record bodies, including bare link or image definitions with no corresponding reference node.
- ALS v1 rejects `thematicBreak`.
- Rejection of these intentionally unsupported markdown forms must use a dedicated body diagnostic instead of the generic unsupported-block diagnostic used for supported block types that are simply disallowed by a region contract.

## Normative Effect

- Required: raw HTML is invalid anywhere in a record body, including inside paragraphs, headings, and other phrasing content.
- Required: reference-style links and images are invalid in ALS v1 record bodies.
- Required: bare markdown definitions are invalid in ALS v1 record bodies.
- Required: thematic breaks are invalid in ALS v1 record bodies.
- Required: intentionally unsupported markdown forms use a dedicated body diagnostic that tells authors what syntax to use instead.
- Allowed: inline markdown links and inline markdown images.
- Allowed: the existing inline phrasing subset currently used by authored v1 records, excluding raw HTML and reference-style syntax.
- Rejected: enabling HTML as a shortcut or configurable option in current v1.
- Rejected: treating reference-style links or images as supported because the Markdown parser can emit `definition`, `linkReference`, or `imageReference`.
- Rejected: relying on generic unsupported-block diagnostics as the normative contract for these markdown forms.

## Compiler Impact

- Add and use a dedicated body diagnostic code for intentionally unsupported markdown in record bodies.
- Record-body validation must scan the full body AST recursively so inline `html`, `linkReference`, and `imageReference` are rejected intentionally instead of passing implicitly.
- Freeform block validation must not also emit the generic unsupported-block diagnostic for top-level `definition`, flow `html`, or `thematicBreak` once the dedicated rejection path handles them.
- `BODY_CONSTRAINT_VIOLATION` remains the diagnostic for supported block types used in a region that does not allow them, such as `table` in a section that does not declare `table`.

## Docs and Fixture Impact

- The canonical shape-language reference must state the supported inline markdown subset and the intentionally rejected markdown forms.
- The reference docs must state that reference-style links and images are unsupported in ALS v1 and must be rewritten as inline links or images.
- The reference docs must state that raw HTML is rejected everywhere in record bodies.
- Compiler tests must add explicit negative coverage for:
  - `definition`
  - `linkReference`
  - `imageReference`
  - flow `html`
  - inline `html`
  - `thematicBreak`

## Alternatives Considered

- Allow reference-style links and images in current v1.
- Rejected because ALS v1 is intentionally keeping a smaller markdown surface and the current body contract does not need definition-bearing syntax.
- Allow raw HTML in current v1.
- Rejected because it expands the authoring surface beyond the supported markdown subset and weakens portability and predictability.
- Allow thematic breaks in current v1.
- Rejected because they are presentation syntax outside the current explicit body block model.

## Follow-Up

- If ALS later broadens the markdown subset, record that expansion in a new SDR rather than weakening this rejection contract in place.
