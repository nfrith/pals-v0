# Reserved Agent Markdown Files

## Status

Accepted

## Context

- ALS v1 module validation currently discovers every markdown file in a module subtree and treats unmatched files as validation errors.
- Real systems may already contain dense AI instruction hierarchies with `AGENTS.md` and `CLAUDE.md` files at many directory levels.
- ALS needs a narrow exception for those industry-standard filenames without introducing a general ignore mechanism that could hide invalid records.

## Decision

- `AGENTS.md` and `CLAUDE.md` are reserved non-record markdown filenames in ALS v1 module subtrees.
- The reservation applies anywhere under a declared module mount path.
- Matching is ASCII case-insensitive for the full filename, including the `.md` extension.
- Reserved agent markdown files are ignored during record discovery and are never parsed or validated as ALS records.
- Reserved agent markdown filenames take precedence over entity path matching.
- All other markdown files inside a module subtree remain subject to normal ALS discovery and validation rules.

## Normative Effect

- Required: the validator must ignore any case variant of `AGENTS.md` or `CLAUDE.md` found within a module subtree.
- Required: ignored reserved agent files must not emit record diagnostics.
- Required: reserved agent files must not become ALS records even when their paths would otherwise match an entity template.
- Allowed: multiple reserved agent files at different depths within the same module subtree.
- Rejected: treating reserved agent files as valid ALS records.
- Rejected: introducing a general markdown exclusion or glob mechanism as part of this decision.
- Rejected: extending this exception to other markdown filenames such as `README.md`.

## Compiler Impact

- Module discovery must classify markdown files into record candidates and reserved agent files before parse and entity inference.
- `PAL-RV-PARSE-003` remains the diagnostic for non-reserved stray markdown.
- Validation summaries must report ignored reserved agent file counts separately from checked, passed, and failed record counts.
- Ignored reserved agent files must not affect module or system pass/fail status.

## Docs and Fixture Impact

- v1 reference docs must state that `AGENTS.md` and `CLAUDE.md` are reserved non-record files at any module depth.
- Compiler tests must cover root-level, nested, mixed-case, and record-path placements of reserved agent files.
- Compiler tests must preserve the rule that non-reserved stray markdown inside a module subtree still fails validation.

## Alternatives Considered

- Keep rejecting all unmatched markdown.
- Rejected because ALS adoption into existing large memory systems would fail on standard agent instruction files.
- Add a configurable ignore list or glob syntax.
- Rejected because it creates a broad escape hatch that can hide invalid ALS records at scale.
- Ignore only module-root reserved files.
- Rejected because real memory systems place agent instruction files throughout nested subdirectories.

## Supersedes

- Narrows the stray-markdown rule in `003-path-based-module-layout.md` for the reserved filenames `AGENTS.md` and `CLAUDE.md`.
