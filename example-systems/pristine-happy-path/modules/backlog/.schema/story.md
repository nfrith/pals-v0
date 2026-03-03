---
entity: story
schema_version: 1.2
id_pattern: ^STORY-[0-9]{4}$
frontmatter_contract:
  id:
    type: string
    required: true
    pattern: ^STORY-[0-9]{4}$
  title:
    type: string
    required: true
  status:
    type: enum
    required: true
    allowed: [draft, ready, in-progress, done]
  epic_ref:
    type: ghost_ref
    required: true
    module: backlog
    id_pattern: ^EPIC-[0-9]{4}$
  people:
    type: array
    required: false
    items:
      type: ghost_ref
      module: people
      id_pattern: ^PPL-[0-9]{6}$
body_contract:
  source: markdown
  section_contract_model: inline
---

# {STORY NAME}

## CONTEXT

- required: true
- value_type: markdown_string
- nullable: false
- empty_marker: null
- includes: business context, why this story matters, and relevant dependencies
- excludes: final acceptance checklist (belongs in ACCEPTANCE)

## ACCEPTANCE

- required: true
- value_type: markdown_list
- nullable: false
- empty_marker: null
- includes: concrete completion conditions and validation criteria
- excludes: historical commentary or unrelated roadmap discussion

## NOTES

- required: true
- value_type: markdown_string
- nullable: true
- empty_marker: null
- includes: optional implementation notes, caveats, and reminders
- excludes: mandatory requirements (belongs in CONTEXT/ACCEPTANCE)
