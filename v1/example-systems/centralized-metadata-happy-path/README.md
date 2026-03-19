# Centralized Metadata Happy Path

This fixture is an alternate clean ALS-style system built from the same domain data as `pristine-happy-path`, but with a different metadata placement strategy.

## What Changed

1. Authoritative module shape metadata lives under `.als/`.
2. `.als/system.yaml` owns the single `system_id` for canonical ALS refs.
3. The system registry declares real top-level roots such as `workspace/` and `clients/`.
4. Modules are direct children of one root via `root + dir`.
5. Shape files are inferred by convention as `.als/modules/<module-id>/v<version>.yaml`.
6. Module shape files contain only module contents, not repeated registry metadata.

## Intent

Use this fixture to evaluate a middle path between:

1. Per-directory metadata (`MODULE.md` + `.schema/` everywhere).
2. One giant whole-system contract file.

This model centralizes metadata at the system root, but keeps ownership module-scoped with one versioned shape file per module version.

## Layout

1. `.als/system.yaml`
2. `.als/modules/<module>/vN.yaml`
3. `<root>/<module-dir>/...` data records

In this trimmed `v1` fixture, skill paths still exist as metadata in `.als/system.yaml`, but the example-system-local skill files are intentionally omitted.

## Tradeoff This Fixture Is Testing

- Better: one obvious place to inspect system shape, lower schema duplication, cleaner data tree.
- Better: a single `system_id` owns canonical identity, while roots only describe file placement.
- Better: the mental model is simple: root = top-level folder, module = direct child.
- Better: section content rules are explicit enough for AST-based validation instead of loose `prose`/`list` heuristics.
- Worse: metadata is farther from records, and module edits usually touch `.als/` plus skill content.
- Explicit non-goal: this fixture does not make one monolithic file authoritative for the entire system.
