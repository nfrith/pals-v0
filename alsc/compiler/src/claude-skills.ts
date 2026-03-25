import { cpSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { SystemConfig } from "./schema.ts";
import {
  inferredSkillEntryPath,
  toRepoRelative,
  toSystemRelative,
} from "./system-paths.ts";
import type {
  ClaudeSkillDeployOutput,
  ClaudeSkillProjectionCollision,
  ClaudeSkillProjectionPlan,
} from "./types.ts";
import { loadSystemValidationContext, validateLoadedSystem } from "./validate.ts";

export interface ClaudeSkillDeployOptions {
  dry_run?: boolean;
  module_filter?: string;
  require_empty_targets?: boolean;
}

interface ClaudeSkillProjectionWorkPlan extends ClaudeSkillProjectionPlan {
  source_dir_abs: string;
  target_dir_abs: string;
}

type ClaudeSkillDeployProceedStatus = Exclude<ClaudeSkillDeployOutput["validation_status"], "fail">;

export function deployClaudeSkills(systemRootInput: string, options: ClaudeSkillDeployOptions = {}): ClaudeSkillDeployOutput {
  const systemRootAbs = resolve(systemRootInput);
  const validationContext = loadSystemValidationContext(systemRootAbs);
  const systemRootRel = validationContext.system_root_rel;
  const dryRun = options.dry_run ?? false;
  const moduleFilter = options.module_filter ?? null;
  const requireEmptyTargets = options.require_empty_targets ?? false;
  const initialValidation = validateLoadedSystem(validationContext);

  if (initialValidation.status === "fail") {
    return buildFailureOutput(
      systemRootRel,
      initialValidation.status,
      moduleFilter,
      dryRun,
      requireEmptyTargets,
      "System validation failed. Fix validation errors before deploying Claude skills.",
    );
  }

  const systemConfig = validationContext.system_config;
  if (!systemConfig) {
    return buildFailureOutput(
      systemRootRel,
      "fail",
      moduleFilter,
      dryRun,
      requireEmptyTargets,
      "System validation did not produce a deployable system configuration.",
    );
  }

  if (moduleFilter && !systemConfig.modules[moduleFilter]) {
    return buildFailureOutput(
      systemRootRel,
      "fail",
      moduleFilter,
      dryRun,
      requireEmptyTargets,
      `Unknown module filter '${moduleFilter}'.`,
    );
  }

  return deployClaudeSkillsFromConfig(systemRootAbs, systemConfig, initialValidation.status, options);
}

export function deployClaudeSkillsFromConfig(
  systemRootInput: string,
  systemConfig: SystemConfig,
  validationStatus: ClaudeSkillDeployProceedStatus,
  options: ClaudeSkillDeployOptions = {},
): ClaudeSkillDeployOutput {
  const systemRootAbs = resolve(systemRootInput);
  const systemRootRel = toRepoRelative(systemRootAbs);
  const dryRun = options.dry_run ?? false;
  const moduleFilter = options.module_filter ?? null;
  const requireEmptyTargets = options.require_empty_targets ?? false;

  if (moduleFilter && !systemConfig.modules[moduleFilter]) {
    return buildFailureOutput(
      systemRootRel,
      "fail",
      moduleFilter,
      dryRun,
      requireEmptyTargets,
      `Unknown module filter '${moduleFilter}'.`,
    );
  }

  const plans = buildProjectionPlans(systemRootAbs, systemConfig, moduleFilter);
  const existingTargets = collectExistingTargets(plans);
  const plannedSkills = plans.map(toProjectionPlan);

  if (requireEmptyTargets && existingTargets.length > 0) {
    return {
      schema: "als-claude-skill-deploy-output@1",
      status: "fail",
      system_path: systemRootRel,
      generated_at: new Date().toISOString(),
      validation_status: validationStatus,
      module_filter: moduleFilter,
      dry_run: dryRun,
      require_empty_targets: requireEmptyTargets,
      planned_skill_count: plans.length,
      written_skill_count: 0,
      planned_skills: plannedSkills,
      existing_targets: existingTargets,
      error: "One or more target paths already exist under .claude/skills.",
    };
  }

  if (!dryRun) {
    for (const plan of plans) {
      rmSync(plan.target_dir_abs, { recursive: true, force: true });
      mkdirSync(dirname(plan.target_dir_abs), { recursive: true });
      cpSync(plan.source_dir_abs, plan.target_dir_abs, { recursive: true });
    }
  }

  return {
    schema: "als-claude-skill-deploy-output@1",
    status: "pass",
    system_path: systemRootRel,
    generated_at: new Date().toISOString(),
    validation_status: validationStatus,
    module_filter: moduleFilter,
    dry_run: dryRun,
    require_empty_targets: requireEmptyTargets,
    planned_skill_count: plans.length,
    written_skill_count: dryRun ? 0 : plans.length,
    planned_skills: plannedSkills,
    existing_targets: existingTargets,
    error: null,
  };
}

function buildProjectionPlans(
  systemRootAbs: string,
  systemConfig: SystemConfig,
  moduleFilter: string | null,
): ClaudeSkillProjectionWorkPlan[] {
  const moduleIds = moduleFilter ? [moduleFilter] : Object.keys(systemConfig.modules).sort();
  const plans: ClaudeSkillProjectionWorkPlan[] = [];

  for (const moduleId of moduleIds) {
    const moduleConfig = systemConfig.modules[moduleId];
    for (const skillId of [...moduleConfig.skills].sort()) {
      const sourceEntryAbs = resolve(systemRootAbs, inferredSkillEntryPath(moduleId, moduleConfig.version, skillId));
      const sourceDirAbs = dirname(sourceEntryAbs);
      const targetDirAbs = resolve(systemRootAbs, ".claude/skills", skillId);

      plans.push({
        module_id: moduleId,
        module_version: moduleConfig.version,
        skill_id: skillId,
        source_dir: toSystemRelative(systemRootAbs, sourceDirAbs),
        source_dir_abs: sourceDirAbs,
        target_dir: toSystemRelative(systemRootAbs, targetDirAbs),
        target_dir_abs: targetDirAbs,
      });
    }
  }

  return plans;
}

function collectExistingTargets(plans: ClaudeSkillProjectionWorkPlan[]): ClaudeSkillProjectionCollision[] {
  const collisions: ClaudeSkillProjectionCollision[] = [];

  for (const plan of plans) {
    const stat = safeStat(plan.target_dir_abs);
    if (!stat) continue;

    collisions.push({
      module_id: plan.module_id,
      skill_id: plan.skill_id,
      source_dir: plan.source_dir,
      target_dir: plan.target_dir,
      target_kind: stat.isDirectory() ? "directory" : "file",
    });
  }

  return collisions;
}

function toProjectionPlan(plan: ClaudeSkillProjectionWorkPlan): ClaudeSkillProjectionPlan {
  return {
    module_id: plan.module_id,
    module_version: plan.module_version,
    skill_id: plan.skill_id,
    source_dir: plan.source_dir,
    target_dir: plan.target_dir,
  };
}

function safeStat(pathAbs: string): ReturnType<typeof statSync> | null {
  try {
    return statSync(pathAbs);
  } catch (error) {
    if (isMissingPathError(error)) {
      return null;
    }
    throw error;
  }
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT",
  );
}

function buildFailureOutput(
  systemRootRel: string,
  validationStatus: ClaudeSkillDeployOutput["validation_status"],
  moduleFilter: string | null,
  dryRun: boolean,
  requireEmptyTargets: boolean,
  error: string,
): ClaudeSkillDeployOutput {
  return {
    schema: "als-claude-skill-deploy-output@1",
    status: "fail",
    system_path: systemRootRel,
    generated_at: new Date().toISOString(),
    validation_status: validationStatus,
    module_filter: moduleFilter,
    dry_run: dryRun,
    require_empty_targets: requireEmptyTargets,
    planned_skill_count: 0,
    written_skill_count: 0,
    planned_skills: [],
    existing_targets: [],
    error,
  };
}
