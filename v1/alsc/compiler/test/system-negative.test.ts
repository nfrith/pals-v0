import { expect, test } from "bun:test";
import { chmod } from "node:fs/promises";
import { join } from "node:path";
import { codes, reasons } from "../src/diagnostics.ts";
import {
  expectSystemDiagnostic,
  mkdirPath,
  updateSystemYaml,
  validateFixture,
  withFixtureSandbox,
  writePath,
} from "./helpers/fixture.ts";

function isRootUser(): boolean {
  return typeof process.getuid === "function" && process.getuid() === 0;
}

for (const invalidPath of [
  "./clients/registry",
  "/clients/registry",
  "clients//registry",
  "clients/../registry",
  ".pals/registry",
  "clients/.cache",
]) {
  test.concurrent(`module paths must be normalized relative slug paths (${invalidPath})`, async () => {
    await withFixtureSandbox("system-module-path-invalid", async ({ root }) => {
      await updateSystemYaml(root, (config) => {
        const modules = config.modules as Record<string, Record<string, unknown>>;
        modules["client-registry"].path = invalidPath;
      });

      const result = validateFixture(root);
      expect(result.status).toBe("fail");
      expectSystemDiagnostic(result, codes.SYSTEM_INVALID, ".als/system.yaml");
    });
  });
}

test.concurrent("declared module paths must exist on disk", async () => {
  await withFixtureSandbox("system-module-path-missing", async ({ root }) => {
    await updateSystemYaml(root, (config) => {
      const modules = config.modules as Record<string, Record<string, unknown>>;
      modules["client-registry"].path = "ghost-root";
    });

    const result = validateFixture(root);
    expect(result.status).toBe("fail");
    expectSystemDiagnostic(result, codes.SYSTEM_MODULE_PATH_INVALID, "ghost-root");
  });
});

test.concurrent("declared module paths must be directories", async () => {
  await withFixtureSandbox("system-module-path-file", async ({ root }) => {
    await writePath(root, "clients/registry-file", "not a directory");
    await updateSystemYaml(root, (config) => {
      const modules = config.modules as Record<string, Record<string, unknown>>;
      modules["client-registry"].path = "clients/registry-file";
    });

    const result = validateFixture(root);
    expect(result.status).toBe("fail");
    expectSystemDiagnostic(result, codes.SYSTEM_MODULE_PATH_INVALID, "clients/registry-file");
  });
});

test.concurrent("exact duplicate module paths are rejected", async () => {
  await withFixtureSandbox("system-path-conflict-exact", async ({ root }) => {
    await updateSystemYaml(root, (config) => {
      const modules = config.modules as Record<string, Record<string, unknown>>;
      modules["client-registry"].path = "workspace/backlog";
    });

    const result = validateFixture(root);
    expect(result.status).toBe("fail");
    const diagnostic = expectSystemDiagnostic(result, codes.SYSTEM_MODULE_PATH_CONFLICT, ".als/system.yaml");
    expect(diagnostic.message).toContain("workspace/backlog");
  });
});

test.concurrent("nested module paths are rejected", async () => {
  await withFixtureSandbox("system-path-conflict-nested", async ({ root }) => {
    await mkdirPath(root, "workspace/backlog/archive");
    await updateSystemYaml(root, (config) => {
      const modules = config.modules as Record<string, Record<string, unknown>>;
      modules["client-registry"].path = "workspace/backlog/archive";
    });

    const result = validateFixture(root);
    expect(result.status).toBe("fail");
    const diagnostic = expectSystemDiagnostic(result, codes.SYSTEM_MODULE_PATH_CONFLICT, ".als/system.yaml");
    expect(diagnostic.message).toContain("workspace/backlog/archive");
  });
});

test.concurrent("ancestor module paths are rejected", async () => {
  await withFixtureSandbox("system-path-conflict-ancestor", async ({ root }) => {
    await updateSystemYaml(root, (config) => {
      const modules = config.modules as Record<string, Record<string, unknown>>;
      modules["client-registry"].path = "workspace";
    });

    const result = validateFixture(root);
    expect(result.status).toBe("fail");
    const diagnostic = expectSystemDiagnostic(result, codes.SYSTEM_MODULE_PATH_CONFLICT, ".als/system.yaml");
    expect(diagnostic.message).toContain("workspace");
  });
});

test.concurrent("missing inferred shape files are rejected", async () => {
  await withFixtureSandbox("system-missing-shape", async ({ root }) => {
    await updateSystemYaml(root, (config) => {
      const modules = config.modules as Record<string, Record<string, unknown>>;
      modules["client-registry"].version = 9;
    });

    const result = validateFixture(root);
    expect(result.status).toBe("fail");
    expectSystemDiagnostic(result, codes.SHAPE_FILE_MISSING, ".als/modules/client-registry/v9.yaml");
  });
});

test.concurrent("inferred shape paths must be files", async () => {
  await withFixtureSandbox("system-shape-path-file", async ({ root }) => {
    await mkdirPath(root, ".als/modules/client-registry/v9.yaml");
    await updateSystemYaml(root, (config) => {
      const modules = config.modules as Record<string, Record<string, unknown>>;
      modules["client-registry"].version = 9;
    });

    const result = validateFixture(root);
    expect(result.status).toBe("fail");
    expectSystemDiagnostic(result, codes.SHAPE_FILE_MISSING, ".als/modules/client-registry/v9.yaml");
  });
});

test.concurrent("unknown module filters fail cleanly", async () => {
  await withFixtureSandbox("system-filter-unknown", async ({ root }) => {
    const result = validateFixture(root, "ghost-module");
    expect(result.status).toBe("fail");
    expectSystemDiagnostic(result, codes.SYSTEM_FILTER_UNKNOWN, ".als/system.yaml");
  });
});

test.concurrent("stale top-level schema fields in system config are rejected", async () => {
  await withFixtureSandbox("system-stale-schema-field", async ({ root }) => {
    await updateSystemYaml(root, (config) => {
      config.schema = "als-system@1";
    });

    const result = validateFixture(root);
    expect(result.status).toBe("fail");
    const diagnostic = expectSystemDiagnostic(result, codes.SYSTEM_INVALID, ".als/system.yaml");
    expect(diagnostic.reason).toBe(reasons.SYSTEM_SCHEMA_REMOVED);
  });
});

test.concurrent("missing als_version fails with a dedicated system diagnostic", async () => {
  await withFixtureSandbox("system-als-version-missing", async ({ root }) => {
    await updateSystemYaml(root, (config) => {
      delete config.als_version;
    });

    const result = validateFixture(root);
    expect(result.status).toBe("fail");
    const diagnostic = expectSystemDiagnostic(result, codes.SYSTEM_ALS_VERSION_INVALID, ".als/system.yaml");
    expect(diagnostic.reason).toBe(reasons.SYSTEM_ALS_VERSION_INVALID);
  });
});

for (const { label, value } of [
  { label: "zero", value: 0 },
  { label: "negative integer", value: -1 },
  { label: "string", value: "one" },
]) {
  test.concurrent(`invalid als_version values are rejected (${label})`, async () => {
    await withFixtureSandbox(`system-als-version-invalid-${label.replaceAll(" ", "-")}`, async ({ root }) => {
      await updateSystemYaml(root, (config) => {
        config.als_version = value;
      });

      const result = validateFixture(root);
      expect(result.status).toBe("fail");
      const diagnostic = expectSystemDiagnostic(result, codes.SYSTEM_ALS_VERSION_INVALID, ".als/system.yaml");
      expect(diagnostic.reason).toBe(reasons.SYSTEM_ALS_VERSION_INVALID);
      expect(diagnostic.field).toBe("als_version");
    });
  });
}

test.concurrent("unsupported als_version stops validation before module loading", async () => {
  await withFixtureSandbox("system-als-version-unsupported", async ({ root }) => {
    await updateSystemYaml(root, (config) => {
      config.als_version = 2;
    });

    const result = validateFixture(root);
    expect(result.status).toBe("fail");
    const diagnostic = expectSystemDiagnostic(result, codes.SYSTEM_ALS_VERSION_UNSUPPORTED, ".als/system.yaml");
    expect(diagnostic.reason).toBe(reasons.SYSTEM_ALS_VERSION_UNSUPPORTED);
    expect(result.modules).toHaveLength(0);
    expect(result.als_version).toBe(2);
  });
});

test.concurrent("stale schema diagnostics do not suppress other system parse errors", async () => {
  await withFixtureSandbox("system-stale-schema-plus-missing-als-version", async ({ root }) => {
    await updateSystemYaml(root, (config) => {
      config.schema = "als-system@1";
      delete config.als_version;
    });

    const result = validateFixture(root);
    expect(result.status).toBe("fail");
    expect(result.system_diagnostics.some((diagnostic) => diagnostic.reason === reasons.SYSTEM_SCHEMA_REMOVED)).toBe(true);
    expect(
      result.system_diagnostics.some(
        (diagnostic) =>
          diagnostic.code === codes.SYSTEM_ALS_VERSION_INVALID
          && diagnostic.reason === reasons.SYSTEM_ALS_VERSION_INVALID
          && diagnostic.field === "als_version",
      ),
    ).toBe(true);
  });
});

test.concurrent("unreadable system config files fail cleanly", async () => {
  await withFixtureSandbox("system-unreadable-config", async ({ root }) => {
    if (isRootUser()) return;

    const systemConfigPath = join(root, ".als/system.yaml");
    await chmod(systemConfigPath, 0o000);

    try {
      const result = validateFixture(root);
      expect(result.status).toBe("fail");
      const diagnostic = expectSystemDiagnostic(result, codes.SYSTEM_INVALID, ".als/system.yaml");
      expect(diagnostic.message).toContain("Could not read YAML file");
      expect(diagnostic.hint).toContain("Check file permissions");
    } finally {
      await chmod(systemConfigPath, 0o600);
    }
  });
});
