import { expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deployClaudeSkillsFromConfig } from "../src/claude-skills.ts";
import { loadSystemValidationContext } from "../src/validate.ts";
import { withFixtureSandbox } from "./helpers/fixture.ts";

const compilerRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test.concurrent("deploy CLI projects active skills into .claude/skills and is idempotent", async () => {
  await withFixtureSandbox("deploy-cli-idempotent", async ({ root }) => {
    await rm(join(root, ".claude/skills"), { recursive: true, force: true });

    const first = Bun.spawnSync({
      cmd: ["bun", "src/deploy.ts", root],
      cwd: compilerRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(first.exitCode).toBe(0);

    const firstOutput = JSON.parse(new TextDecoder().decode(first.stdout)) as {
      status: string;
      planned_skill_count: number;
      written_skill_count: number;
      planned_skills: Array<Record<string, unknown>>;
      existing_targets: unknown[];
    };
    expect(firstOutput.status).toBe("pass");
    expect(firstOutput.planned_skill_count).toBe(5);
    expect(firstOutput.written_skill_count).toBe(5);
    expect(firstOutput.existing_targets).toEqual([]);
    for (const plan of firstOutput.planned_skills) {
      expect(plan).not.toHaveProperty("source_dir_abs");
      expect(plan).not.toHaveProperty("target_dir_abs");
      expect(plan.source_dir).toEqual(expect.stringMatching(/^\.als\/modules\//));
      expect(plan.target_dir).toEqual(expect.stringMatching(/^\.claude\/skills\//));
    }

    const firstSnapshot = snapshotTree(join(root, ".claude/skills"));
    expect(firstSnapshot["backlog-module/SKILL.md"]).toContain("name: backlog-module");
    expect(firstSnapshot["people-module/SKILL.md"]).toContain("name: people-module");

    const second = Bun.spawnSync({
      cmd: ["bun", "src/deploy.ts", root],
      cwd: compilerRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(second.exitCode).toBe(0);

    const secondSnapshot = snapshotTree(join(root, ".claude/skills"));
    expect(secondSnapshot).toEqual(firstSnapshot);
  });
});

test.concurrent("deploy CLI dry-run reports planned work without creating .claude/skills", async () => {
  await withFixtureSandbox("deploy-cli-dry-run", async ({ root }) => {
    await rm(join(root, ".claude/skills"), { recursive: true, force: true });

    const process = Bun.spawnSync({
      cmd: ["bun", "src/deploy.ts", "--dry-run", root],
      cwd: compilerRoot,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(process.exitCode).toBe(0);
    const output = JSON.parse(new TextDecoder().decode(process.stdout)) as {
      status: string;
      planned_skill_count: number;
      written_skill_count: number;
      planned_skills: Array<Record<string, unknown>>;
    };
    expect(output.status).toBe("pass");
    expect(output.planned_skill_count).toBeGreaterThan(0);
    expect(output.written_skill_count).toBe(0);
    expect(existsSync(join(root, ".claude/skills"))).toBe(false);
    for (const plan of output.planned_skills) {
      expect(plan).not.toHaveProperty("source_dir_abs");
      expect(plan).not.toHaveProperty("target_dir_abs");
    }
  });
});

test.concurrent("deploy CLI can target a single module", async () => {
  await withFixtureSandbox("deploy-cli-module-filter", async ({ root }) => {
    await rm(join(root, ".claude/skills"), { recursive: true, force: true });

    const process = Bun.spawnSync({
      cmd: ["bun", "src/deploy.ts", root, "backlog"],
      cwd: compilerRoot,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(process.exitCode).toBe(0);
    const snapshot = snapshotTree(join(root, ".claude/skills"));
    expect(Object.keys(snapshot)).toEqual(["backlog-module/SKILL.md"]);
  });
});

test.concurrent("deploy CLI fails unknown module filters before planning work", async () => {
  await withFixtureSandbox("deploy-cli-unknown-module", async ({ root }) => {
    await rm(join(root, ".claude/skills"), { recursive: true, force: true });

    const process = Bun.spawnSync({
      cmd: ["bun", "src/deploy.ts", "--dry-run", root, "ghost-module"],
      cwd: compilerRoot,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(new TextDecoder().decode(process.stdout)) as {
      status: string;
      validation_status: string;
      planned_skill_count: number;
      error: string | null;
    };
    expect(output.status).toBe("fail");
    expect(output.validation_status).toBe("fail");
    expect(output.planned_skill_count).toBe(0);
    expect(output.error).toContain("Unknown module filter 'ghost-module'");
  });
});

test.concurrent("deploy CLI fails preflight when empty targets are required", async () => {
  await withFixtureSandbox("deploy-cli-collision", async ({ root }) => {
    await mkdir(join(root, ".claude/skills/backlog-module"), { recursive: true });
    await writeFile(join(root, ".claude/skills/backlog-module/SKILL.md"), "---\nname: backlog-module\ndescription: collision\n---\n");

    const process = Bun.spawnSync({
      cmd: ["bun", "src/deploy.ts", "--dry-run", "--require-empty-targets", root, "backlog"],
      cwd: compilerRoot,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(process.exitCode).toBe(1);
    const output = JSON.parse(new TextDecoder().decode(process.stdout)) as {
      status: string;
      existing_targets: Array<{ skill_id: string; target_dir: string; target_kind: string }>;
      error: string | null;
    };
    expect(output.status).toBe("fail");
    expect(output.error).toContain("target paths already exist");
    expect(output.existing_targets).toHaveLength(1);
    expect(output.existing_targets[0].skill_id).toBe("backlog-module");
    expect(output.existing_targets[0].target_dir).toContain(".claude/skills/backlog-module");
    expect(output.existing_targets[0].target_kind).toBe("directory");
  });
});

test.concurrent("deploy library projects skills when validation status is warn", async () => {
  await withFixtureSandbox("deploy-library-warning", async ({ root }) => {
    await rm(join(root, ".claude/skills"), { recursive: true, force: true });

    const validationContext = loadSystemValidationContext(root);
    expect(validationContext.system_config).not.toBeNull();

    const output = deployClaudeSkillsFromConfig(root, validationContext.system_config!, "warn", {
      module_filter: "backlog",
    });

    expect(output.status).toBe("pass");
    expect(output.validation_status).toBe("warn");
    expect(output.planned_skill_count).toBe(1);
    expect(output.written_skill_count).toBe(1);
    expect(existsSync(join(root, ".claude/skills/backlog-module/SKILL.md"))).toBe(true);
  });
});

function snapshotTree(root: string): Record<string, string> {
  const snapshot: Record<string, string> = {};
  walk(root, root, snapshot);
  return snapshot;
}

function walk(root: string, current: string, snapshot: Record<string, string>): void {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      walk(root, fullPath, snapshot);
      continue;
    }

    snapshot[relativeFrom(root, fullPath)] = readFileSync(fullPath, "utf-8");
  }
}

function relativeFrom(root: string, filePath: string): string {
  return filePath.slice(root.length + 1).replace(/\\/g, "/");
}
