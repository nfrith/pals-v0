import { expect, test } from "bun:test";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { codes } from "../src/diagnostics.ts";
import { validateSystem } from "../src/validate.ts";

const fixtureRoot = resolve(process.cwd(), "../../example-systems/centralized-metadata-happy-path");

async function copyFixture(): Promise<string> {
  const tempRoot = await mkdtemp(join(tmpdir(), "pals-compiler-"));
  await cp(fixtureRoot, tempRoot, { recursive: true });
  return tempRoot;
}

async function rewriteFixtureFile(
  tempRoot: string,
  relativePath: string,
  transform: (current: string) => string,
): Promise<void> {
  const filePath = join(tempRoot, relativePath);
  const current = await readFile(filePath, "utf-8");
  await writeFile(filePath, transform(current));
}

test("centralized metadata fixture validates clean", () => {
  const result = validateSystem(fixtureRoot);
  expect(result.status).toBe("pass");
  expect(result.summary.error_count).toBe(0);
  expect(result.summary.modules_checked).toBe(4);
});

test("disallowed subheading inside a paragraph-only section fails", async () => {
  const tempRoot = await copyFixture();
  await rewriteFixtureFile(
    tempRoot,
    "workspace/backlog/stories/STORY-0001.md",
    (original) =>
      original.replace(
        "Module contracts must reduce ambiguity for orchestrator and module skills.",
        "Module contracts must reduce ambiguity for orchestrator and module skills.\n\n### Illegal Subheading\n\nThis should fail.",
      ),
  );

  const result = validateSystem(tempRoot);
  expect(result.status).toBe("fail");

  const backlogReport = result.modules.find((report) => report.module_id === "backlog");
  expect(backlogReport).toBeDefined();
  expect(
    backlogReport!.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === codes.BODY_CONSTRAINT_VIOLATION &&
        diagnostic.file.endsWith("STORY-0001.md"),
    ),
  ).toBe(true);
});

test("unknown module root fails system validation", async () => {
  const tempRoot = await copyFixture();
  await rewriteFixtureFile(
    tempRoot,
    ".pals/system.yaml",
    (current) => current.replace("root: clients", "root: ghosts"),
  );

  const result = validateSystem(tempRoot);
  expect(result.status).toBe("fail");
  expect(result.system_diagnostics.some((diagnostic) => diagnostic.code === codes.SYSTEM_INVALID)).toBe(true);
});

test("roots must be single-segment slugs", async () => {
  const tempRoot = await copyFixture();
  await rewriteFixtureFile(
    tempRoot,
    ".pals/system.yaml",
    (current) => current.replace("  - clients", "  - clients/nested"),
  );

  const result = validateSystem(tempRoot);
  expect(result.status).toBe("fail");
  expect(result.system_diagnostics.some((diagnostic) => diagnostic.code === codes.SYSTEM_INVALID)).toBe(true);
});

test("module dirs must be single-segment slugs", async () => {
  const tempRoot = await copyFixture();
  await rewriteFixtureFile(
    tempRoot,
    ".pals/system.yaml",
    (current) => current.replace("dir: registry", "dir: registry/nested"),
  );

  const result = validateSystem(tempRoot);
  expect(result.status).toBe("fail");
  expect(result.system_diagnostics.some((diagnostic) => diagnostic.code === codes.SYSTEM_INVALID)).toBe(true);
});

test("declared roots must exist on disk", async () => {
  const tempRoot = await copyFixture();
  await rewriteFixtureFile(
    tempRoot,
    ".pals/system.yaml",
    (current) => current.replace("  - dotfiles", "  - ghosts"),
  );

  const result = validateSystem(tempRoot);
  expect(result.status).toBe("fail");
  expect(result.system_diagnostics.some((diagnostic) => diagnostic.code === codes.SYSTEM_ROOT_INVALID)).toBe(true);
});

test("declared module directories must exist on disk", async () => {
  const tempRoot = await copyFixture();
  await rewriteFixtureFile(
    tempRoot,
    ".pals/system.yaml",
    (current) => current.replace("dir: registry", "dir: missing"),
  );

  const result = validateSystem(tempRoot);
  expect(result.status).toBe("fail");
  expect(result.system_diagnostics.some((diagnostic) => diagnostic.code === codes.SYSTEM_MODULE_DIR_INVALID)).toBe(true);
});

test("duplicate module locations are rejected", async () => {
  const tempRoot = await copyFixture();
  await rewriteFixtureFile(
    tempRoot,
    ".pals/system.yaml",
    (current) =>
      current.replace(
        "  client-registry:\n    root: clients\n    dir: registry\n    version: 1\n",
        "  client-registry:\n    root: workspace\n    dir: backlog\n    version: 1\n",
      ),
  );

  const result = validateSystem(tempRoot);
  expect(result.status).toBe("fail");
  expect(result.system_diagnostics.some((diagnostic) => diagnostic.code === codes.SYSTEM_MODULE_LOCATION_CONFLICT)).toBe(true);
});

test("missing inferred shape files are rejected", async () => {
  const tempRoot = await copyFixture();
  await rewriteFixtureFile(
    tempRoot,
    ".pals/system.yaml",
    (current) => current.replace("version: 1\n    skill: .claude/skills/client-registry-module/SKILL.md", "version: 9\n    skill: .claude/skills/client-registry-module/SKILL.md"),
  );

  const result = validateSystem(tempRoot);
  expect(result.status).toBe("fail");
  expect(result.system_diagnostics.some((diagnostic) => diagnostic.code === codes.SHAPE_FILE_MISSING)).toBe(true);
});
