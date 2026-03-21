# Structured Section Content Language

## Status

Accepted

## Context

- ALS v1 currently models section content with two different mechanisms.
- One mechanism is `allowed_blocks` for `paragraph`, `bullet_list`, and `ordered_list`.
- The other mechanism is boolean toggles for `allow_subheadings`, `allow_blockquotes`, and `allow_code_blocks`.
- That split is inconsistent because some block types are declared directly while others are enabled by special-case flags.
- `allow_subheadings` is semantically unclear because `h2` is structurally consumed as a section boundary, so headings inside sections can only be `h3` or deeper.
- Rich agent-system records need a content model that can describe headings, quotes, code fences, lists, and future block types in one coherent contract.

## Decision

- ALS v1 section and preamble content must use a unified block-language contract instead of `allowed_blocks` plus block-type booleans.
- The content contract must be a discriminated union with `mode: freeform` or `mode: outline`.
- `freeform` content declares block types directly under a single structure such as `content.blocks`.
- `outline` content declares an exact ordered heading tree with optional `preamble` content before the first required child heading.
- `paragraph`, `bullet_list`, `ordered_list`, `heading`, `blockquote`, and `code` are first-class body block types in that unified model.
- Tables are explicitly deferred from the current v1 body contract.
- The legacy booleans `allow_subheadings`, `allow_blockquotes`, and `allow_code_blocks` are removed from the normative authoring model.
- Block-specific constraints are declared alongside the block type they govern.
- The first supported block constraints are:
  - `min_count` / `max_count` for paragraph-like blocks
  - `min_items` / `max_items` for list blocks
  - `require_language` for code blocks
- `heading` permissions must carry explicit depth rules.
- In a declared section region, `h1` is reserved for the record title region.
- In a declared section region, `h2` is reserved for section boundaries.
- Allowed `heading` content inside a section can therefore only match `h3` or deeper.
- A section contract cannot legalize `h1` or `h2` as ordinary section content.
- In current v1, outline nodes are ordered, required, and exact. Optional-node and repeated-node syntax is deferred.
- The same unified content model applies to other body regions such as `preamble` when those regions allow Markdown blocks.
- Future block types must extend the unified block model instead of adding new boolean toggles.

## Normative Effect

- Required: body-region content contracts declare block types in one unified structure.
- Required: body-region content contracts declare whether the region is `freeform` or `outline`.
- Required: `heading` rules state depth constraints explicitly instead of using a generic subheading boolean.
- Required: section-local heading rules treat `h3+` as the available heading range.
- Required: `outline` nodes declare exact heading text and exact heading depth.
- Allowed: `heading`, `blockquote`, and `code` in the same block-language model as paragraphs and lists.
- Allowed: block-specific options that live next to the block type they constrain.
- Allowed: future expansion of the same model to additional Markdown block types.
- Allowed: strict outline regions with a shared `preamble` shape before the first required child heading.
- Rejected: `allow_subheadings`, `allow_blockquotes`, and `allow_code_blocks` as normative shape-language keys.
- Rejected: section rules that treat `h2` as ordinary allowed content.
- Rejected: mixed contracts where some block types are named directly and others are enabled by side-channel booleans.

## Compiler Impact

- Shape parsing needs a single content-contract schema for body regions, including `freeform` and `outline`.
- Validation needs to evaluate `heading` depth constraints explicitly instead of translating a generic subheading toggle.
- Validation needs to evaluate exact outline-node heading text and heading depth for strict outline regions.
- Diagnostics need to report block-type violations in terms of the unified block model and, for headings, the actual depth that failed.
- Legacy boolean keys need a clear rejection or migration path once implementation work starts.

## Docs and Fixture Impact

- Shape-language docs must replace the mixed boolean model with a unified body block contract.
- Docs must explain that section-local `heading` means `h3+`, because `h2` is structural.
- Docs must describe `mode: freeform | outline`, exact outline nodes, the shared `preamble` shape, and the initial supported block constraints.
- The rich-body design-reference fixture must use first-class `heading`, `blockquote`, and `code` block declarations.
- Compiler tests, when implementation starts, must cover heading-depth acceptance and rejection, outline-node heading acceptance and rejection, blockquote acceptance and rejection, code-block acceptance and rejection, and legacy-boolean rejection.

## Alternatives Considered

- Keep `allowed_blocks` and the three boolean toggles.
- Rejected because it preserves an inconsistent contract surface and hides heading semantics.
- Keep a boolean for subheadings and document that it really means `h3+`.
- Rejected because heading depth is part of the contract and should be expressed directly.
- Switch immediately to full raw mdast coverage as the authoring surface.
- Rejected because this decision is about a coherent body-language contract first; additional Markdown block coverage can expand incrementally within that model.
