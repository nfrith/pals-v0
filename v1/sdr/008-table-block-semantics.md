# Table Block Semantics

## Status

Accepted

## Context

- SDR 007 established a unified body block model for `freeform` and `outline` content and explicitly deferred tables from the current v1 body contract.
- Rich agent-system records regularly need tables for comparison matrices, evidence summaries, rollout checklists, and decision tradeoff grids.
- The current question is not whether tables are useful. It is which table form ALS v1 should normatively support and how that support should fit the existing block model without overcommitting to niche Markdown dialects or premature table-specific constraints.
- ALS v1 body contracts are designed around explicit author intent. If tables are supported, the shape language should say so directly.

## Decision

- ALS v1 adds `table` as a first-class body block type within the unified `freeform` block model.
- `table` remains a semantic block name. ALS v1 does not introduce a dialect-coupled block key such as `gfm_table`.
- A declared `table` block must declare its syntax explicitly:
  ```yaml
  blocks:
    table:
      syntax: gfm
  ```
- In current v1, `syntax: gfm` is the only allowed table syntax.
- `table` is allowed anywhere `freeform` block types are allowed, including top-level `preamble`, top-level section regions, and `outline` node content.
- ALS v1 table support is defined in terms of valid GitHub Flavored Markdown pipe tables.
- In current v1, ALS v1 accepts the practical limits of GFM tables:
  - one header row
  - one delimiter row
  - zero or more body rows
  - inline Markdown only inside cells
  - no multiline cell blocks
  - no headerless tables
  - no row spans or column spans
- HTML tables are not part of the ALS v1 body contract.
- Other Markdown table dialects are not part of the ALS v1 body contract.
- In current v1, `table` does not define table-specific row, column, header, alignment, or cell-type constraints.
- A valid table appearing in a region that does not allow `table` uses the existing generic unsupported-block diagnostic behavior already used for other forbidden block types.
- ALS v1 does not add malformed-table heuristics in this pass. If authored pipe syntax is not recognized by the Markdown parser as a valid GFM table, validation proceeds against the blocks the parser actually produced.

## Normative Effect

- Required: a region that wants to allow tables must declare `table` under `content.blocks`.
- Required: a declared `table` block must declare `syntax: gfm`.
- Required: compiler behavior for table recognition is based on valid GFM table parsing, not ad hoc text heuristics.
- Required: a valid table in a region that forbids tables is rejected as an unsupported markdown block.
- Allowed: tables in any `freeform` region, including freeform content nested under outline nodes.
- Allowed: future table syntaxes under the same semantic `table` block, if a later SDR adds them.
- Rejected: implicit table support in regions that do not declare `table`.
- Rejected: raw HTML tables as part of the ALS v1 table contract.
- Rejected: non-GFM table dialects in current v1.
- Rejected: table-specific constraints beyond `syntax` in current v1.
- Rejected: malformed-pipe heuristics that guess author intent when the Markdown parser does not recognize a table.

## Compiler Impact

- Shape parsing needs to accept `table` as a `freeform` block with a required `syntax` key.
- Markdown parsing needs GFM table support enabled for body validation.
- Freeform block validation needs to recognize parsed GFM tables as a distinct `table` block type.
- The generic unsupported-block diagnostic path should continue to handle valid but forbidden tables.
- Table-specific diagnostics are not required in this pass because current v1 does not define table-specific constraints beyond syntax selection.
- Negative tests need to cover:
  - valid GFM tables accepted when declared
  - valid GFM tables rejected when not declared
  - invalid `table.syntax` rejected at shape-validation time
  - malformed pipe syntax not being treated as a valid table

## Docs and Fixture Impact

- Shape-language docs must add `table` to the supported `freeform` block types and document `syntax: gfm`.
- Docs must explicitly note the adopted GFM limitations that matter for authored ALS records, especially inline-only cells and no multiline cell blocks.
- The rich-body fixtures should gain realistic table-bearing records, such as:
  - research comparison tables
  - incident evidence summary tables
  - planning tradeoff matrices
- Shape YAML in those fixtures should declare `blocks.table.syntax: gfm` in the relevant body regions.
- Existing fixtures that do not use tables do not need to change.

## Alternatives Considered

- Use `gfm_table` as the block type name.
- Rejected because the block type should stay semantic while the dialect choice stays explicit in configuration.
- Support HTML tables in current v1.
- Rejected because HTML tables weaken the Markdown-centered authoring contract and expand parser and validation complexity without enough evidence yet.
- Support multiple table syntaxes immediately.
- Rejected because current v1 needs one explicit, widely implemented baseline first.
- Add row and column constraints in the first table pass.
- Rejected because the main unresolved decision is table syntax and block identity, not fine-grained table validation.
- Add heuristics for malformed pipe text that looks table-like.
- Rejected because ALS v1 should validate against parsed Markdown structure, not speculative recovery logic.
