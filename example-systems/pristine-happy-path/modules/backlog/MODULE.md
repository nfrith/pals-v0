---
module_id: backlog
module_version: 1
schema_version: 1.0
compat:
  read_versions: [1]
  write_version: 1
references:
  scheme: ghost
  canonical_pattern: ghost://backlog/<opaque-id>
---

# Backlog Module

## Ownership

- Owns epic and story records under this module directory.
- External modules reference backlog entities via `ghost://backlog/...` only.

## Invariants

1. Stories must reference an epic.
2. IDs are opaque and stable.
3. Required sections must exist in every record.

## Entity Paths

- Epics: `epics/<EPIC-ID>.md`
- Stories: `stories/<STORY-ID>.md`
