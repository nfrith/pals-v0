# Path-Based Module Layout

## Status

Accepted

## Context

- Earlier `als-system@1` modeled module placement with a top-level `roots` list plus per-module `root` and `dir` fields.
- That model made filesystem placement a first-class language concept without giving `root` any independent meaning in refs, identity, dependencies, or record semantics.
- The practical value of `roots` was limited to shared-prefix grouping and phased migration of existing directory trees.
- The root-based model also created awkward layouts for root-mounted modules, such as `backlog/backlog`, when the intended module directory was simply `backlog/`.
- ALS v1 still needs strict placement rules at scale, but those rules should be attached to an explicit module mount path rather than a separate root abstraction.

## Decision

- `als-system@1` defines module placement with `modules.<module_id>.path`.
- `roots`, `modules.<module_id>.root`, and `modules.<module_id>.dir` are removed from the normative system model.
- `modules.<module_id>.path` is a relative module mount path from the validated system root directory.
- A module mount path is one or more slash-separated slug segments.
- Each segment uses the same slug grammar as module identifiers: lowercase alphanumeric segments with optional internal hyphens, starting with a letter.
- Module placement is explicit and must not be inferred from naming equality between a module id and any directory name.
- A module owns the entire subtree mounted at its declared path.
- Module mount paths must be pairwise non-overlapping by segment prefix.
- Exact duplicate paths are invalid.
- A module path that is an ancestor of another module path is invalid.
- A module path that is nested under another module path is invalid.
- A module may be mounted at a single-segment path such as `backlog`.
- A module may be mounted at a nested path such as `section9/backlog`.
- Canonical ALS refs and module identity continue to use `system_id` and `module_id`, not filesystem path text.

## Normative Effect

- Required: every module declares exactly one explicit `path` in `als-system@1`.
- Required: module placement is interpreted relative to the validated system root directory.
- Required: module mount paths use normalized slug segments separated by `/`.
- Required: every declared module path resolves to an existing directory.
- Required: every declared module subtree is exclusively owned by one module.
- Allowed: single-segment root-mounted modules such as `dotfiles`.
- Allowed: nested migration paths such as `section9/backlog`.
- Rejected: using `roots`, `root`, or `dir` as normative module-placement inputs.
- Rejected: inferring root-mounted behavior from a module id matching a directory name.
- Rejected: exact duplicate module mount paths.
- Rejected: ancestor or descendant overlap between module mount paths.
- Rejected: non-normalized path forms such as empty segments, absolute paths, `.` segments, `..` segments, or hidden segments.
- Rejected: treating unmatched markdown inside an owned module subtree as outside the module.

## Compiler Impact

- System config parsing and validation use `modules.<module_id>.path` as the only placement field.
- Layout validation resolves module directories from `path`, not from `root + dir`.
- Layout validation emits `PAL-CV-SYS-004` when a declared module path is missing or is not a directory.
- Layout validation emits `PAL-CV-SYS-005` when two module mount paths duplicate or overlap.
- `PAL-CV-SYS-003` is retired because system roots are no longer part of `als-system@1`.
- Module discovery walks the entire mounted subtree owned by each module path.
- Canonical URI generation, module dependencies, and shape lookup remain keyed by module id and are not rewritten around filesystem path text.

## Docs and Fixture Impact

- Reference docs must describe `als-system@1` in terms of `modules.<module_id>.path`.
- Authoring guidance and skills must ask for a module mount path relative to the system root, not a root name plus child directory.
- Example systems and fixtures must not describe module placement with `roots`, `root`, or `dir`.
- Fixtures may include both single-segment and nested module mount paths.
- Tests must cover invalid path syntax, missing module directories, non-directory mounts, duplicate paths, and ancestor or descendant overlap.
- Tests and examples must preserve the rule that stray markdown inside a mounted module subtree is a validation error.

## Alternatives Considered

- Keep `roots` plus per-module `root` and `dir`.
- Rejected because `root` only encoded placement structure and did not add durable semantics to the language.
- Infer root-mounted modules when a module id matches a root or directory name.
- Rejected because it makes names semantically magical and leaves the literal `backlog/backlog` case ambiguous.
- Introduce an explicit placement union such as `kind: root` versus `kind: child`.
- Rejected because it preserves extra language surface for a distinction that does not need to exist in the core spec.
