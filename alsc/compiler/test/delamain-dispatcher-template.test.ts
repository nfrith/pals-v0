import { expect, test } from "bun:test";
import { join } from "node:path";
import { deployClaudeSkillsFromConfig } from "../src/claude-skills.ts";
import { loadSystemValidationContext } from "../src/validate.ts";
import { loadRuntimeManifest } from "../../../skills/new/references/dispatcher/src/runtime-manifest.ts";
import { scan } from "../../../skills/new/references/dispatcher/src/watcher.ts";
import { withFixtureSandbox, writePath } from "./helpers/fixture.ts";

test("dispatcher resolve fails closed when runtime manifest is missing", async () => {
  await withFixtureSandbox("delamain-dispatcher-manifest-missing", async ({ root }) => {
    const bundleRoot = join(root, ".als/modules/factory/v1/delamains/development-pipeline");

    await expect(loadRuntimeManifest(bundleRoot)).rejects.toThrow(
      "Missing runtime-manifest.json",
    );
  });
});

test("dispatcher resolve uses deployed runtime manifest metadata", async () => {
  await withFixtureSandbox("delamain-dispatcher-resolve", async ({ root }) => {
    const validationContext = loadSystemValidationContext(root);
    expect(validationContext.system_config).not.toBeNull();

    const output = deployClaudeSkillsFromConfig(root, validationContext.system_config!, "pass", {
      module_filter: "factory",
    });
    expect(output.status).toBe("pass");

    const bundleRoot = join(root, ".claude/delamains/development-pipeline");
    const manifest = await loadRuntimeManifest(bundleRoot);

    expect(manifest.delamain_name).toBe("development-pipeline");
    expect(manifest.module_id).toBe("factory");
    expect(manifest.entity_name).toBe("work-item");
    expect(manifest.entity_path).toBe("items/{id}.md");
    expect(manifest.status_field).toBe("status");
    expect(manifest.module_mount_path).toBe("workspace/factory");
  });
});

test("dispatcher scan discovers nested entity paths from runtime manifest bindings", async () => {
  await withFixtureSandbox("delamain-dispatcher-nested-scan", async ({ root }) => {
    const validationContext = loadSystemValidationContext(root);
    expect(validationContext.system_config).not.toBeNull();

    const output = deployClaudeSkillsFromConfig(root, validationContext.system_config!, "pass", {
      module_filter: "experiments",
    });
    expect(output.status).toBe("pass");

    const bundleRoot = join(root, ".claude/delamains/run-lifecycle");
    const manifest = await loadRuntimeManifest(bundleRoot);
    const items = await scan(
      join(root, manifest.module_mount_path),
      manifest.entity_path,
      manifest.status_field,
      manifest.discriminator_field ?? undefined,
      manifest.discriminator_value ?? undefined,
    );

    const byId = new Map(items.map((item) => [item.id, item]));
    expect(items.map((item) => item.id).sort()).toEqual(["RUN-0001", "RUN-0002", "RUN-0003"]);
    expect(byId.get("RUN-0001")?.status).toBe("completed");
    expect(byId.get("RUN-0002")?.status).toBe("completed");
    expect(byId.get("RUN-0003")?.status).toBe("running");
    expect(byId.get("RUN-0003")?.filePath).toContain(
      "workspace/experiments/programs/PRG-0001/experiments/EXP-0001/runs/RUN-0003.md",
    );
  });
});

test("dispatcher scan honors non-status field names and discriminator filtering", async () => {
  await withFixtureSandbox("delamain-dispatcher-discriminator-scan", async ({ root }) => {
    const bundleRoot = join(root, ".claude/delamains/synthetic-lifecycle");

    await writePath(
      root,
      ".claude/delamains/synthetic-lifecycle/runtime-manifest.json",
      JSON.stringify(
        {
          schema: "als-delamain-runtime-manifest@1",
          delamain_name: "synthetic-lifecycle",
          module_id: "synthetic",
          module_version: 1,
          module_mount_path: "runtime-module",
          entity_name: "item",
          entity_path: "items/{id}.md",
          status_field: "lifecycle",
          discriminator_field: "type",
          discriminator_value: "app",
        },
        null,
        2,
      ) + "\n",
    );
    await writePath(
      root,
      ".claude/delamains/synthetic-lifecycle/delamain.yaml",
      [
        "phases: [execution, closed]",
        "",
        "states:",
        "  queued:",
        "    initial: true",
        "    phase: execution",
        "    actor: agent",
        "    resumable: false",
        "    path: agents/queued.md",
        "  completed:",
        "    phase: closed",
        "    terminal: true",
        "",
        "transitions:",
        "  - class: exit",
        "    from: queued",
        "    to: completed",
        "",
      ].join("\n"),
    );
    await writePath(
      root,
      ".claude/delamains/synthetic-lifecycle/agents/queued.md",
      [
        "---",
        "name: queued",
        "description: Synthetic queued agent",
        "---",
        "",
        "Inspect the record and move it when appropriate.",
        "",
      ].join("\n"),
    );

    await writePath(
      root,
      "runtime-module/items/APP-001.md",
      [
        "---",
        "id: APP-001",
        "type: app",
        "lifecycle: queued",
        "---",
        "",
        "# APP-001",
        "",
      ].join("\n"),
    );
    await writePath(
      root,
      "runtime-module/items/OPS-001.md",
      [
        "---",
        "id: OPS-001",
        "type: ops",
        "lifecycle: queued",
        "---",
        "",
        "# OPS-001",
        "",
      ].join("\n"),
    );

    const manifest = await loadRuntimeManifest(bundleRoot);
    const items = await scan(
      join(root, manifest.module_mount_path),
      manifest.entity_path,
      manifest.status_field,
      manifest.discriminator_field ?? undefined,
      manifest.discriminator_value ?? undefined,
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("APP-001");
    expect(items[0]?.status).toBe("queued");
    expect(items[0]?.filePath).toContain("runtime-module/items/APP-001.md");
  });
});
