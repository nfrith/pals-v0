---
name: experiments-module
description: Operate on the PALS experiments module with nested program/experiment/run hierarchy.
---

# Experiments Module Skill

## Use This Skill When

1. You need to read or update experiment programs.
2. You need to add experiment runs under the correct parent experiment.
3. You need module-owned interpretation of experiment outcomes.

## Scope

- Read/write scope: `workspace/experiments/`
- Do not write outside module scope.

## Write Rules

1. Enforce schema in `workspace/experiments/.schema/`.
2. Preserve hierarchical containment path contracts.
3. Enforce canonical references: `pals://workspace/experiments/<opaque-id>`.
4. Keep required sections present and use `null` for explicit empty content.
