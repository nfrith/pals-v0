import { relative } from "node:path";

export function inferredModuleBundlePath(moduleId: string, version: number): string {
  return `.als/modules/${moduleId}/v${version}`;
}

export function inferredShapePath(moduleId: string, version: number): string {
  return `${inferredModuleBundlePath(moduleId, version)}/shape.yaml`;
}

export function inferredSkillsPath(moduleId: string, version: number): string {
  return `${inferredModuleBundlePath(moduleId, version)}/skills`;
}

export function inferredSkillEntryPath(moduleId: string, version: number, skillId: string): string {
  return `${inferredSkillsPath(moduleId, version)}/${skillId}/SKILL.md`;
}

export function inferredMigrationsPath(moduleId: string, version: number): string {
  return `${inferredModuleBundlePath(moduleId, version)}/migrations`;
}

export function toRepoRelative(pathAbs: string): string {
  return relative(process.cwd(), pathAbs).replace(/\\/g, "/") || ".";
}

export function toSystemRelative(systemRootAbs: string, pathAbs: string): string {
  return relative(systemRootAbs, pathAbs).replace(/\\/g, "/") || ".";
}
