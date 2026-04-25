import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { OperatorConfig } from "../src/operator-config.ts";
import {
  buildOperatorConfigSessionStartOutput,
  inspectOperatorConfigSource,
  resolveOperatorConfigPath,
  serializeOperatorConfigDocument,
} from "../src/operator-config.ts";
import { runCli } from "../src/cli.ts";

const VALID_OPERATOR_CONFIG: OperatorConfig = {
  config_version: 1,
  created: "2026-04-25",
  updated: "2026-04-25",
  first_name: "Nick",
  last_name: "Frith",
  display_name: null,
  primary_email: "nick@example.com",
  role: "Founder",
  profiles: ["operator"],
  owns_company: true,
  company_name: "Example Co",
  company_type: "llc",
  company_type_other: null,
  revenue_band: "100k-1M",
};

test("resolveOperatorConfigPath prefers XDG_CONFIG_HOME over HOME", () => {
  expect(resolveOperatorConfigPath({
    XDG_CONFIG_HOME: "/tmp/als-xdg",
    HOME: "/tmp/als-home",
  })).toBe("/tmp/als-xdg/als/operator.md");
});

test("operator config round-trips through markdown serialization and inspection", () => {
  const source = serializeOperatorConfigDocument({
    config: VALID_OPERATOR_CONFIG,
    body: "## Notes\n\nStable operator context.\n",
  });
  const inspection = inspectOperatorConfigSource(source, "/tmp/operator.md");

  expect(inspection.status).toBe("pass");
  expect(inspection.errors).toEqual([]);
  expect(inspection.warnings).toEqual([]);
  expect(inspection.config).toEqual(VALID_OPERATOR_CONFIG);
  expect(inspection.body).toContain("Stable operator context.");
});

test("operator config inspection blocks credential-like values", () => {
  const source = serializeOperatorConfigDocument({
    config: {
      ...VALID_OPERATOR_CONFIG,
      company_name: "sk-abcdefghijklmnopqrstuvwx123456",
    },
    body: "",
  });
  const inspection = inspectOperatorConfigSource(source, "/tmp/operator.md");

  expect(inspection.status).toBe("fail");
  expect(inspection.errors).toEqual([]);
  expect(inspection.warnings).toHaveLength(1);
  expect(inspection.warnings[0]?.path).toBe("company_name");
});

test("session-start output injects the operator reminder when the config is valid", async () => {
  await withTempDir("operator-config-session-start", async (root) => {
    const homeDir = join(root, "home");
    const projectDir = join(root, "project");
    const operatorConfigPath = join(homeDir, ".config", "als", "operator.md");

    await mkdir(projectDir, { recursive: true });
    await mkdir(join(homeDir, ".config", "als"), { recursive: true });
    await writeFile(
      operatorConfigPath,
      serializeOperatorConfigDocument({
        config: VALID_OPERATOR_CONFIG,
        body: "",
      }),
    );

    const output = buildOperatorConfigSessionStartOutput(projectDir, { HOME: homeDir });
    expect(output).toContain("<system-reminder>");
    expect(output).toContain("Stable operator context loaded");
    expect(output).toContain("Revenue band: 100k-1M");
  });
});

test("session-start output is suppressed when the current ALS system opts out", async () => {
  await withTempDir("operator-config-session-start-skip", async (root) => {
    const homeDir = join(root, "home");
    const systemRoot = join(root, "system");
    const operatorConfigPath = join(homeDir, ".config", "als", "operator.md");

    await mkdir(join(homeDir, ".config", "als"), { recursive: true });
    await mkdir(join(systemRoot, ".als"), { recursive: true });
    await writeFile(join(systemRoot, ".als", "system.ts"), "export const system = {};\n");
    await writeFile(join(systemRoot, ".als", "skip-operator-config"), "skip\n");
    await writeFile(
      operatorConfigPath,
      serializeOperatorConfigDocument({
        config: VALID_OPERATOR_CONFIG,
        body: "",
      }),
    );

    const output = buildOperatorConfigSessionStartOutput(systemRoot, { HOME: homeDir });
    expect(output).toBe("");
  });
});

test("cli operator-config inspect reports missing files without failing", () => {
  const result = captureCli(["operator-config", "inspect", "/tmp/als-missing-operator-config.md"]);
  expect(result.exitCode).toBe(0);
  const output = JSON.parse(result.stdout) as { status: string; exists: boolean };
  expect(output.status).toBe("missing");
  expect(output.exists).toBe(false);
});

test("cli operator-config session-start prints remediation for invalid configs", async () => {
  await withTempDir("operator-config-cli-remediation", async (root) => {
    const homeDir = join(root, "home");
    const projectDir = join(root, "project");
    const operatorConfigPath = join(homeDir, ".config", "als", "operator.md");

    await mkdir(projectDir, { recursive: true });
    await mkdir(join(homeDir, ".config", "als"), { recursive: true });
    await writeFile(
      operatorConfigPath,
      `---
config_version: 1
created: 2026-04-25
updated: 2026-04-25
first_name: Nick
last_name: Frith
display_name: null
primary_email: not-an-email
role: Founder
profiles:
  - operator
owns_company: false
company_name: null
company_type: null
company_type_other: null
revenue_band: null
---
`,
    );

    const result = captureCli(["operator-config", "session-start", projectDir], { HOME: homeDir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Run /operator-config to repair it");
    expect(result.stdout).toContain("primary_email");
  });
});

function captureCli(
  args: string[],
  env: Record<string, string | undefined> = process.env,
): { exitCode: number; stdout: string; stderr: string } {
  let stdout = "";
  let stderr = "";
  const exitCode = runCli(args, {
    stdout(value) {
      stdout += value.endsWith("\n") ? value : `${value}\n`;
    },
    stderr(value) {
      stderr += value.endsWith("\n") ? value : `${value}\n`;
    },
  }, env);

  return { exitCode, stdout, stderr };
}

async function withTempDir(label: string, run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), `${label}-`));
  let runError: unknown = null;

  try {
    await run(root);
  } catch (error) {
    runError = error;
  }

  await rm(root, { recursive: true, force: true });

  if (runError) {
    throw runError;
  }
}
