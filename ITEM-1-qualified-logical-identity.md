# Item 1 Proposed Solution: Qualified Logical Identity

Status: proposed
Related TODO item: `TODO.md` -> `### 1. Duplicate ID in fixture contradicts spec`

## Problem

The current baseline assumes canonical refs use:

`pals://<namespace>/<module>/<id>`

That only works if `id` is unique across the whole module. The fixture contradicts that assumption in `experiments`, where `EXP-0001` exists under multiple programs.

This is not just a fixture bug. It exposes a deeper issue:

- bare module-local IDs are ambiguous for nested entities
- cross-module refs can point at the wrong record
- search and agent reasoning become error-prone
- forcing global uniqueness creates awkward names like "the first experiment under PRG-0005 is EXP-0205"

## Decision Summary

Adopt fully qualified logical names as the canonical record identity and canonical ref target.

Keep these rules:

1. `id` remains the required local identifier field for every record.
2. Filename stem must continue to equal frontmatter `id`.
3. `id` remains filename-friendly and record-local.

Add these rules:

1. Each entity may be either:
   - root identity
   - child identity qualified by exactly one parent ref
2. Canonical URIs are built from the full logical parent chain, not a bare module-local `id`.
3. Child records should store only immediate-parent refs when higher ancestors are derivable.

## Proposed Identity Model

Identity is declared per entity schema with an explicit identity contract.

Root entity:

```yaml
identity_contract:
  local_id_field: id
```

Child entity:

```yaml
identity_contract:
  local_id_field: id
  parent_ref_field: program_ref
```

Deep child entity:

```yaml
identity_contract:
  local_id_field: id
  parent_ref_field: experiment_ref
```

Notes:

1. `local_id_field` is fixed to `id` in the current proposal.
2. `parent_ref_field` is singular. This keeps identity tree-shaped and avoids a general composite-key model in the baseline.
3. If an entity has no `parent_ref_field`, it is rooted directly under the module namespace.

## Canonical URI Rules

The current 3-segment URI contract is replaced by a qualified logical-path contract:

`pals://<namespace>/<module>/<qualified-id-path>`

Where `<qualified-id-path>` is:

1. root entity: `<id>`
2. child entity: `<parent-qualified-id-path>/<id>`

Examples:

- program: `pals://workspace/experiments/PRG-0001`
- experiment: `pals://workspace/experiments/PRG-0001/EXP-0001`
- run: `pals://workspace/experiments/PRG-0001/EXP-0001/RUN-0001`

These are logical names, not raw filesystem paths, even if they often mirror the module tree.

## Example Shapes

Program record:

```yaml
---
id: PRG-0001
title: Pricing Page Rework
status: active
owner_ref: "[alex-rivera](pals://workspace/people/PPL-000101)"
---
```

Program schema identity:

```yaml
identity_contract:
  local_id_field: id
```

Experiment record:

```yaml
---
id: EXP-0001
program_ref: "[pricing-page-rework](pals://workspace/experiments/PRG-0001)"
title: Headline Variant Test
status: active
budget: 12000
owner_ref: "[mira-chen](pals://workspace/people/PPL-000204)"
---
```

Experiment schema identity:

```yaml
identity_contract:
  local_id_field: id
  parent_ref_field: program_ref
```

Run record:

```yaml
---
id: RUN-0001
experiment_ref: "[headline-variant-test](pals://workspace/experiments/PRG-0001/EXP-0001)"
status: completed
outcome: positive
started_on: 2026-02-10
ended_on: 2026-02-11
---
```

Run schema identity:

```yaml
identity_contract:
  local_id_field: id
  parent_ref_field: experiment_ref
```

## Normalization Rule

Do not duplicate derivable ancestor refs unless they carry independent business meaning.

Applied to the current fixture:

1. `experiment` keeps `program_ref`.
2. `run` keeps `experiment_ref`.
3. `run.program_ref` should be removed, because program identity is derivable from `experiment_ref`.

This keeps the model closer to normalized relational structure without turning refs into opaque DB-only foreign keys.

## Why This Direction

1. It removes ambiguity for agents and humans.
2. It avoids global module-wide uniqueness pressure for nested entities.
3. It preserves a stable local `id` for filenames and authoring.
4. It supports namespace-like reasoning closer to qualified names in strongly typed systems.
5. It keeps the baseline model hierarchical instead of introducing arbitrary composite identities too early.

## Explicit Non-Goals For This Proposal

1. Do not support arbitrary identity field names such as `ExperimentId`.
2. Do not introduce `scope: module | parent`.
3. Do not support general multi-field composite identity in the baseline.
4. Do not treat raw filesystem paths as canonical refs.

## Follow-On Spec Work Required If Accepted

If this proposal is accepted, the normative specs will need coordinated updates in at least:

1. `SPEC.md`
2. `palsc/references/frontmatter-schema-definition.md`
3. `palsc/references/record-validation.md`
4. `palsc/references/module-schema-definition.md`
5. `palsc/references/diagnostic-codes.md`
6. example fixture schemas and records under `example-systems/pristine-happy-path`

## Review Questions

1. Should canonical URI grammar remain entity-agnostic (`.../PRG-0001/EXP-0001`) or become entity-tagged (`.../program/PRG-0001/experiment/EXP-0001`)?
2. Should the compiler require that `parent_ref_field` target an entity whose canonical URI is a strict prefix of the child URI?
3. Should `run.program_ref` be fully removed from the fixture, or retained only if the domain explicitly needs direct program-level semantics on runs?
