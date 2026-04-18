# Final Report

End `/install` with a tight operator-facing summary.

Include:

- `Platform` — the acknowledged ALS platform code
- `Prerequisites` — whether `CLAUDE_PLUGIN_ROOT`, `bun`, and `jq` were confirmed
- `System ID` — the `system_id` chosen in Phase 4
- `Created` — `.als/authoring.ts`, `.als/system.ts`, and the empty `.als/modules/` directory
- `Validation` — result of `validate`
- `Deploy` — result of `deploy claude --dry-run --require-empty-targets` and the live `deploy claude` (produces `.claude/CLAUDE.md` and an otherwise empty projection surface)
- `Next` — the Phase 7 outcome: which skill was invoked (`/foundry` or `/new`), or "stopped at skeleton"
- `Later` — commands the operator can reach for any time: `/new`, `/foundry`, `/change`, `/validate`

No module, skill, or delamain output belongs in this report — `/install` does not author any of those. If a downstream skill was invoked in Phase 7, its own output covers what it produced.
