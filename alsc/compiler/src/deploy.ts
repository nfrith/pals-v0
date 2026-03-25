#!/usr/bin/env bun

import { resolve } from "node:path";
import { deployClaudeSkills } from "./claude-skills.ts";

interface ParsedCliArgs {
  dry_run: boolean;
  require_empty_targets: boolean;
  system_root: string;
  module_filter: string | null;
}

const parsed = parseArgs(process.argv.slice(2));
if (!parsed) {
  console.error("Usage: bun src/deploy.ts [--dry-run] [--require-empty-targets] <system-root> [module-id]");
  process.exit(2);
}

const result = deployClaudeSkills(resolve(parsed.system_root), {
  dry_run: parsed.dry_run,
  module_filter: parsed.module_filter ?? undefined,
  require_empty_targets: parsed.require_empty_targets,
});

console.log(JSON.stringify(result, null, 2));

if (result.status === "fail") {
  process.exit(1);
}

function parseArgs(args: string[]): ParsedCliArgs | null {
  const positionals: string[] = [];
  let dryRun = false;
  let requireEmptyTargets = false;

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--require-empty-targets") {
      requireEmptyTargets = true;
      continue;
    }

    if (arg.startsWith("--")) {
      return null;
    }

    positionals.push(arg);
  }

  if (positionals.length < 1 || positionals.length > 2) {
    return null;
  }

  return {
    dry_run: dryRun,
    require_empty_targets: requireEmptyTargets,
    system_root: positionals[0],
    module_filter: positionals[1] ?? null,
  };
}
