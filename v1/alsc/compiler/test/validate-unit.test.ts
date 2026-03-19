import { expect, test } from "bun:test";
import { codes } from "../src/diagnostics.ts";
import { systemConfigSchema, type VariantEntityShape } from "../src/schema.ts";
import { resolveEffectiveEntityContract } from "../src/validate.ts";

test("missing section definitions surface a shape diagnostic instead of crashing", () => {
  const entityShape: VariantEntityShape = {
    path: "items/{id}.md",
    identity: {
      id_field: "id",
    },
    fields: {
      id: {
        type: "id",
        allow_null: false,
      },
      type: {
        type: "enum",
        allow_null: false,
        allowed_values: ["app"],
      },
    },
    discriminator: "type",
    section_definitions: {},
    variants: {
      app: {
        fields: {},
        sections: ["DESCRIPTION"],
      },
    },
  };

  const result = resolveEffectiveEntityContract(
    entityShape,
    {
      id: "ITEM-0001",
      type: "app",
    },
    {
      module_id: "backlog",
      entity_name: "item",
      record_file: "workspace/backlog/items/ITEM-0001.md",
      shape_file: ".als/modules/backlog/v1.yaml",
    },
  );

  expect(result.sections).toBeNull();
  expect(result.known_field_names).toEqual(["id", "type"]);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.body_diagnostics).toHaveLength(0);
  expect(result.diagnostics[0].code).toBe(codes.SHAPE_CONTRACT_INVALID);
});

test("system config schema rejects duplicate module mount paths", () => {
  const result = systemConfigSchema.safeParse({
    schema: "als-system@1",
    system_id: "test-system",
    modules: {
      backlog: {
        path: "workspace/backlog",
        version: 1,
        skill: ".claude/skills/backlog/SKILL.md",
      },
      archive: {
        path: "workspace/backlog",
        version: 1,
        skill: ".claude/skills/archive/SKILL.md",
      },
    },
  });

  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error("Expected duplicate module mount paths to fail schema validation");
  }

  expect(result.error.issues.some((issue) => issue.path.join(".") === "modules.archive.path")).toBe(true);
});

test("system config schema rejects overlapping module mount paths", () => {
  const result = systemConfigSchema.safeParse({
    schema: "als-system@1",
    system_id: "test-system",
    modules: {
      backlog: {
        path: "workspace/backlog",
        version: 1,
        skill: ".claude/skills/backlog/SKILL.md",
      },
      workspace: {
        path: "workspace",
        version: 1,
        skill: ".claude/skills/workspace/SKILL.md",
      },
    },
  });

  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error("Expected overlapping module mount paths to fail schema validation");
  }

  expect(result.error.issues.some((issue) => issue.path.join(".") === "modules.workspace.path")).toBe(true);
});
