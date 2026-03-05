# Schema Content Definition (Current Baseline)

## Scope

This document defines the allowed markdown body structure for schema files.
It works with frontmatter `body_contract` where:

1. `source: markdown`
2. `section_contract_model: inline`

## Canonical Type Model

```ts
type SchemaBody = {
  title_h1: string;
  sections: Record<SectionName, SectionContract>;
};

type SectionContract = {
  required: boolean;
  value_type: "markdown_string" | "markdown_list" | "markdown_string_or_list";
  nullable: boolean;
  empty_marker: null;
  includes: string;
  excludes: string;
};
```

## Canonical Markdown Shape

```md
# {ENTITY NAME}

## <SECTION_NAME>

- required: <true|false>
- value_type: <markdown_string|markdown_list|markdown_string_or_list>
- nullable: <true|false>
- empty_marker: null
- includes: <non-empty guidance string>
- excludes: <non-empty guidance string>
```

Repeat the `## <SECTION_NAME>` block for each section in the schema.

## Compiler Enforcement Rules

1. Schema body must contain one top-level H1 title (`# ...`) before section contracts.
2. Section contracts must be declared under level-2 headings (`## ...`).
3. Section names must be unique within one schema file.
4. Every section contract must include all keys:
   - `required`
   - `value_type`
   - `nullable`
   - `empty_marker`
   - `includes`
   - `excludes`
5. `value_type` must be one of:
   - `markdown_string`
   - `markdown_list`
   - `markdown_string_or_list`
6. `empty_marker` must be literal `null`.
7. `includes` and `excludes` must be non-empty strings.
8. Unknown section-contract keys are invalid in the current baseline.

## Validation Semantics Against Data Records

1. `required: true` means the section must exist in data records.
2. `required: false` means section may be absent.
3. `nullable: true` means explicit empty (`null`) is allowed when section exists.
4. `nullable: false` means explicit empty (`null`) is not allowed.
5. Missing and explicit empty (`null`) are distinct states.
6. A required section that is missing is a schema violation.

## Value Type Meaning

1. `markdown_string`: prose/block text section content.
2. `markdown_list`: list-form section content.
3. `markdown_string_or_list`: either prose or list content.

## Explicitly Not Supported (Current Baseline)

1. Per-section custom empty markers.
2. Non-markdown section content models.
3. Deep typed section sub-schemas beyond `value_type` + nullability.
