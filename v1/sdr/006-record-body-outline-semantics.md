# Record Body Outline Semantics

## Status

Proposed

## Context

- ALS v1 currently discovers body sections by splitting raw text on `##` lines instead of interpreting the Markdown outline.
- That behavior silently drops the `#` title and any content before the first `##`, creating an invisible body region outside the shape contract.
- The current shape language only declares ordered body sections, so authors cannot explicitly model a title region or a preamble region even when those regions are semantically important.
- Rich agent-system records regularly need a visible title, pre-section context, and nested section content.
- The intended direction is that every structural region of a record body is declared in the shape schema.

## Decision

- ALS v1 body contracts must become explicit record-outline contracts instead of implicit `##` section lists.
- An entity body contract must be able to declare a `title` region rendered as exactly one Markdown `h1`.
- An entity body contract must be able to declare a `preamble` region for top-level body content between the title region and the first declared section, or before the first declared section when no title region is declared.
- An entity body contract must be able to declare ordered `sections` rendered as Markdown `h2`.
- Declared body-region membership controls presence. If a region is declared, it must appear. If a region is not declared, authored content for that region is invalid.
- `title` is first-class.
- If `title` is declared, exactly one `h1` is required.
- If `title` is declared, the `h1` text must match an explicitly named field such as `title`.
- There is no implicit rule that the `h1` must match `id`.
- `preamble` is first-class. Any authored content between the `h1` region and the first `h2` section belongs to `preamble` and must be declared explicitly if present.
- `sections` remain ordered and explicitly declared, but section extraction is based on Markdown heading structure, not raw-text delimiters.
- Body outline extraction is mdast-based. Structural headings are determined from heading nodes and depth, not from regex matches such as `^## (.+)$`.
- Top-level body content that cannot be assigned to a declared `title`, declared `preamble`, or declared `section` is invalid.
- Multiple `h1` headings in a record body are invalid.

## Normative Effect

- Required: every authored top-level body region is declared in the shape contract.
- Required: a declared `title` region produces exactly one `h1`.
- Required: a declared `title` region names the field whose value the `h1` must match.
- Required: a declared `preamble` region models top-level content before the first declared `h2` section.
- Required: declared sections are interpreted as `h2` outline regions in the order declared by the shape.
- Required: section extraction follows Markdown AST semantics rather than raw line matching.
- Allowed: records with no `h1` when the shape does not declare a `title` region.
- Allowed: records with no pre-section prose when the shape does not declare a `preamble` region.
- Rejected: invisible or silently discarded body content before the first section.
- Rejected: implicit `title == id` semantics.
- Rejected: regex-based section splitting as the normative record-body model.
- Rejected: authored top-level prose outside declared `title`, `preamble`, and `section` regions.

## Compiler Impact

- Shape parsing needs an explicit body-contract model that can represent `title`, `preamble`, and ordered `sections`.
- Record-body parsing needs an mdast-based outline pass that identifies top-level heading regions by depth.
- Validation needs dedicated diagnostics for undeclared `title` regions, undeclared `preamble` regions, missing declared regions, and title-to-field mismatches.
- Existing body-order checks need to operate on mdast-derived outline regions rather than regex-derived section names.

## Docs and Fixture Impact

- Shape-language docs must describe an explicit body contract rather than only ordered `##` sections.
- Docs must state that `h1` is no longer informal when a `title` region is declared.
- Docs must state that pre-section prose is either a declared `preamble` region or invalid.
- The existing `centralized-metadata-happy-path` fixture remains the current structural smoke fixture and is not rewritten to force this model.
- A separate rich-body design-reference fixture must show declared `title`, declared `preamble`, and ordered `h2` sections on realistic records.
- Tests, when implementation starts, must cover missing title regions, undeclared preamble content, title-field mismatch, multiple `h1` headings, and mdast-based section extraction.

## Alternatives Considered

- Keep `h1` informal and only model `h2` sections.
- Rejected because it preserves invisible body structure outside the schema.
- Auto-infer the first `h1` and pre-section prose without explicit declarations.
- Rejected because implicit regions weaken the declaration contract and hide authoring mistakes.
- Keep regex-based `##` splitting and add narrow exceptions.
- Rejected because Markdown outline semantics should come from the Markdown AST, not from raw-line delimiters.
