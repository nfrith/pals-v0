# File Path Frontmatter Type

## Status

Accepted

## Context

- ALS v1 frontmatter currently supports `id`, `string`, `number`, `date`, `enum`, `ref`, and `list`.
- Real systems need frontmatter fields that point to local filesystem artifacts that are not ALS-addressable entities.
- Migration-heavy systems often need ALS records to point to plain markdown, JSON, CSV, PDF, or other files outside the declaring module subtree.
- `ref` is the wrong contract for those targets because `ref` carries ALS identity and dependency semantics rather than filesystem artifact semantics.
- Treating these paths as raw `string` values leaves an important contract unmodeled and unvalidated.
- Collapsing local filesystem paths into a generic `url` or `uri` type would hide important differences in validation, resolution, portability, and future evolution.

## Decision

- ALS v1 adds a scalar frontmatter field type `file_path`.
- ALS v1 adds `list.items.type: file_path`.
- `file_path` declares a filesystem artifact pointer. It does not declare ALS identity.
- Every `file_path` shape must declare `base`.
- Allowed `base` values are `system_root` and `host_absolute`.
- `base: system_root` resolves from the explicit ALS system root directory that contains `.als/system.yaml`.
- `base: host_absolute` resolves from an absolute host filesystem path on the validator host platform.
- `file_path` values use plain YAML strings. They do not use markdown-link syntax.
- `file_path` targets must exist at validation time and must resolve to files, not directories.
- `file_path` targets may live inside or outside the declaring module subtree.
- `file_path` targets may live under hidden paths and under `.als/...`.
- `file_path` does not participate in module dependency validation, canonical identity generation, or ALS ref resolution.
- When the intended meaning is ALS entity identity, authors should use `ref` instead of `file_path`, even if the target entity is stored as a markdown file.
- This decision does not add automatic coercion, aliasing, or hybrid behavior between `file_path` and `ref`.
- This decision uses `base` as the anchor selector. It does not add a separate `resolution` knob.
- This decision does not add Git-aware bases such as `git_root`.

## Normative Effect

- Required: scalar `file_path` fields declare `base`.
- Required: `list<file_path>` item shapes declare `base`.
- Required: scalar `file_path` values are non-empty strings.
- Required: `list<file_path>` members are non-empty strings.
- Required: `system_root` values use normalized forward-slash relative paths.
- Required: `system_root` values must not begin with `/`, `\`, or a drive prefix such as `C:`.
- Required: `system_root` values must not contain `\`, `.`, `..`, or empty path segments.
- Required: `host_absolute` values must be normalized absolute file paths on the validator host platform.
- Required: `host_absolute` values must not contain empty, `.`, or `..` path segments after the root.
- Required: `host_absolute` values must not end with a directory separator.
- Required: resolved `file_path` targets exist at validation time and must be accessible enough for validation to confirm they are files.
- Required: resolved `file_path` targets are files, not directories.
- Allowed: `file_path` targets anywhere under the ALS system root when `base: system_root` is used, including outside the declaring module subtree, hidden paths, and `.als/...`.
- Allowed: `file_path` targets outside the ALS system root when `base: host_absolute` is used.
- Allowed: empty `list<file_path>` values for non-null list fields under the existing list contract.
- Allowed: repeated `list<file_path>` entries under the existing list contract.
- Allowed: `file_path` values that point to non-markdown files.
- Rejected: empty-string `file_path` values.
- Rejected: markdown-link syntax for `file_path` values.
- Rejected: URI or URL syntax as the normative contract for `file_path`.
- Rejected: record-relative, module-relative, or Git-relative path bases in this pass.
- Rejected: treating `file_path` as a module dependency edge or an ALS identity edge.
- Rejected: directory targets.

## Compiler Impact

- Extend shape parsing so scalar fields accept `type: file_path` plus required `base`.
- Extend shape parsing so `list.items` accepts `type: file_path` plus required `base`.
- Add validation that resolves `system_root` paths against the loaded ALS system root.
- Add validation that resolves `host_absolute` paths directly on the validator host.
- Add dedicated diagnostics for malformed `file_path` syntax or base/anchor violations.
- Add dedicated diagnostics for missing targets and directory targets.
- Reuse existing frontmatter type-mismatch diagnostics for non-string scalar values and non-string list members.
- Keep `file_path` outside dependency validation, canonical URI generation, and `ref` resolution behavior.

## Docs and Fixture Impact

- Update the canonical shape-language reference to document scalar `file_path`, `list<file_path>`, `base`, validation-time existence checks, hidden-path allowance, and `.als/...` allowance.
- Paint fixture examples that show ALS records pointing to plain files outside the declaring module subtree through `base: system_root`.
- Paint fixture examples that show `list<file_path>` for migration-heavy record surfaces such as session-file attachments.
- Add positive tests for scalar and list `file_path` usage with both `system_root` and `host_absolute`.
- Add positive tests for hidden targets and `.als/...` targets.
- Add negative tests covering missing `base`, unsupported `base`, empty strings, invalid `system_root` syntax, non-absolute `host_absolute` values, missing targets, directory targets, and markdown-link misuse.
- Document that later migration from `file_path` to `ref` is a model change in authored data, not implicit validator aliasing.

## Alternatives Considered

- Use `ref` for any file that lives inside the ALS system tree. Rejected because filesystem artifacts and ALS identity are different contracts.
- Keep raw `string` fields and leave path meaning to higher layers. Rejected because the use case needs first-class validation and teachable semantics.
- Add generic `url` or `uri` instead of `file_path`. Rejected because network locators and filesystem paths need different validation and future evolution.
- Add `git_root` as a supported `base`. Rejected because ALS already has an explicit system root and should not couple authored data to Git topology.
- Add a separate `resolution` knob instead of `base`. Rejected because this decision needs an explicit anchor selector, while existence remains part of the `file_path` contract itself.
