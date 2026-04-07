// Exploratory sketch: people module as a TS-authored bundle.
//
// This is the same shape.yaml expressed in TypeScript, plus two things
// YAML can't do: cross-field validation rules and a real title function.

import { required, optional, section } from "../../../lib/schema.ts";

// ── Entity: person ──────────────────────────────────────────────────

const person = {
  entityId: "person",
  sourceFormat: "markdown",
  path: "persons/{id}.md",

  identity: {
    idField: "id",
  },

  fields: {
    id: required({ type: "id" }),
    display_name: required({ type: "string" }),
    status: required({ type: "enum", values: ["active", "inactive"] }),
    tags: optional({ type: "list", items: { type: "string" } }),
  },

  body: {
    title: (record: { display_name: string }) => record.display_name,

    sections: [
      section("PROFILE", {
        allowNull: false,
        content: { mode: "freeform", blocks: { paragraph: {} } },
        guidance: {
          include: "who this person is and the role they play in this workspace",
          exclude: "transient task updates",
        },
      }),

      section("CONTACT", {
        allowNull: true,
        content: {
          mode: "freeform",
          blocks: { paragraph: {}, bulletList: {}, orderedList: {} },
        },
        guidance: {
          include: "stable contact channels or handles",
          exclude: "private credentials or secrets",
        },
      }),

      section("NOTES", {
        allowNull: true,
        content: { mode: "freeform", blocks: { paragraph: {} } },
        guidance: {
          include: "optional context and collaboration notes",
          exclude: "authoritative policy statements",
        },
      }),
    ],
  },

  // ── Cross-field validation ──────────────────────────────────────
  //
  // These are rules the schema alone can't express.
  // The compiler already validates field types, nullability, enums.
  // These run AFTER that pass, on records that are already schema-valid.

  validate: (record: {
    status: string;
    tags: string[] | null;
    display_name: string;
  }) => {
    const errors: string[] = [];

    // Active persons should be reachable — require at least one tag.
    if (record.status === "active" && (!record.tags || record.tags.length === 0))
      errors.push("active persons must have at least one tag");

    // Display names should be full names, not handles or single words.
    if (record.display_name.trim().split(/\s+/).length < 2)
      errors.push("display_name must contain at least a first and last name");

    return errors;
  },
} as const;

// ── Module bundle ─────────────────────────────────────────────────

export const peopleModule = {
  moduleId: "people",
  version: 1,
  mountPath: "workspace/people",
  dependencies: [],

  skills: {
    "people-module": {
      entry: "skills/people-module/SKILL.md",
    },
  },

  entities: {
    person,
  },
} as const;

export default peopleModule;
