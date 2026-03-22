import type { AlsUpgradeAssistance, AlsUpgradeMode } from "./contracts.ts";

export type DiagnosticSeverity = "error" | "warning";

export type ValidationPhase =
  | "system_config"
  | "module_shape"
  | "parse"
  | "record_frontmatter"
  | "record_body"
  | "identity"
  | "reference"
  | "module_consistency";

export interface CompilerDiagnostic {
  code: string;
  reason: string | null;
  severity: DiagnosticSeverity;
  phase: ValidationPhase;
  file: string;
  location: {
    line: number | null;
    column: number | null;
  };
  module_id: string | null;
  entity: string | null;
  field: string | null;
  message: string;
  expected: unknown;
  actual: unknown;
  hint: string | null;
}

export interface ModuleValidationSummary {
  files_checked: number;
  files_passed: number;
  files_failed: number;
  files_ignored: number;
  error_count: number;
  warning_count: number;
}

export interface ModuleValidationReport {
  status: "pass" | "warn" | "fail";
  module_id: string;
  module_path: string;
  module_version: number;
  diagnostics: CompilerDiagnostic[];
  summary: ModuleValidationSummary;
}

export interface SystemValidationOutput {
  schema: string;
  als_version: number | null;
  compiler_contract: {
    supported_als_versions: number[];
    upgrade_mode: AlsUpgradeMode;
    upgrade_assistance: AlsUpgradeAssistance;
  };
  status: "pass" | "warn" | "fail";
  system_path: string;
  generated_at: string;
  system_diagnostics: CompilerDiagnostic[];
  modules: ModuleValidationReport[];
  summary: {
    modules_checked: number;
    modules_failed: number;
    files_checked: number;
    files_passed: number;
    files_failed: number;
    files_ignored: number;
    error_count: number;
    warning_count: number;
  };
}
