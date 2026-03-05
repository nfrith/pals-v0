# Schema Frontmatter Definition (Current Baseline)

## Scope

This document defines the allowed frontmatter shape for PALS schema files:

1. `workspace/<module>/.schema/<entity>.md`
2. `.claude/skills/<module-skill>/vN/schemas/<entity>.md`

## Canonical Type Model

```ts
type SchemaFileFrontmatter = {
  entity: EntityName;
  schema_version: PositiveInteger;
  frontmatter_contract: Record<FieldName, FieldContract>;
  body_contract: {
    source: "markdown";
    section_contract_model: "inline";
  };
};

type FieldContract =
  | { type: "id"; required: boolean }
  | { type: "string"; required: boolean }
  | { type: "number"; required: boolean }
  | { type: "date"; required: boolean }
  | { type: "enum"; required: boolean; allowed: [string, ...string[]] }
  | {
      type: "ref";
      required: boolean;
      uri_scheme: "pals";
      namespace: string;
      module: string;
      target_entity: string;
    }
  | { type: "array"; required: boolean; items: ArrayItemContract };

type ArrayItemContract =
  | { type: "string" }
  | {
      type: "ref";
      uri_scheme: "pals";
      namespace: string;
      module: string;
      target_entity: string;
    };
```

## Canonical YAML Shape

```yaml
---
entity: <entity-name>
schema_version: <positive-integer>
frontmatter_contract:
  id:
    type: id
    required: true
  <field-name>:
    type: <id|string|number|date|enum|ref|array>
    required: <true|false>
    # enum only
    allowed: [<value>, ...]
    # ref only
    uri_scheme: pals
    namespace: <namespace>
    module: <module-id>
    target_entity: <entity-name>
    # array only
    items:
      type: <string|ref>
      # ref item only
      uri_scheme: pals
      namespace: <namespace>
      module: <module-id>
      target_entity: <entity-name>
body_contract:
  source: markdown
  section_contract_model: inline
---
```

## Compiler Enforcement Rules

1. Top-level frontmatter keys must be exactly: `entity`, `schema_version`, `frontmatter_contract`, `body_contract`.
2. `entity` must be a non-empty identifier string.
3. `schema_version` must be a positive integer.
4. `frontmatter_contract` must be a non-empty object keyed by field name.
5. Every field contract must include `type` and `required`.
6. Allowed field `type` values are only: `id`, `string`, `number`, `date`, `enum`, `ref`, `array`.
7. `enum` fields must include non-empty `allowed` with unique string values.
8. `ref` fields must include: `uri_scheme`, `namespace`, `module`, `target_entity`.
9. `ref.uri_scheme` must be `pals`.
10. `array` fields must include `items`.
11. Array item contracts support only `string` and `ref` in the current baseline.
12. `id` must be declared in `frontmatter_contract` with `type: id` and `required: true`.
13. `body_contract.source` must be `markdown`.
14. `body_contract.section_contract_model` must be `inline`.
15. `schema_version` in each schema file must match module `MODULE.md` `schema_version` for the deployed version.
16. All deployed schema files in a module must share the same `schema_version`.

## Explicitly Not Supported (Current Baseline)

1. Per-entity schema_version divergence inside one deployed module version.
2. Non-markdown body sources.
3. Non-inline body section contract models.
