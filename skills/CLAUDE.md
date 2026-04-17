# ALS Skills

Shared conventions for ALS skill authoring.

## Plugin Root Resolution

Skills resolve the ALS plugin root via **harness substitution** of `${CLAUDE_PLUGIN_ROOT}` in their bash commands. The harness rewrites this placeholder to an absolute path before Bash executes, regardless of whether the subprocess env carries the variable.

**Required form:** bare `${CLAUDE_PLUGIN_ROOT}` — curly braces, no decorations.

**Do not use** — the harness does not substitute these; bash falls back to subprocess env, which is empty on marketplace installs:

- `$CLAUDE_PLUGIN_ROOT` (missing braces)
- `${CLAUDE_PLUGIN_ROOT:-default}` or any other parameter-expansion form (`:-`, `:?`, `:+`, etc.)

**Propagating to child processes** — the harness only substitutes inside command text; child processes inherit whatever Bash has in its env. For children that need the variable (e.g. dispatcher `bun` processes), pass via inline assignment:

```bash
CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT} bun run ...
```

Confirmed on [`ALS-PLAT-CCLI`](docs/references/platforms.md) and [`ALS-PLAT-CDSK`](docs/references/platforms.md) (2026-04-17 via [`/als:whereami`](whereami/SKILL.md)). Untested platforms follow the same rule until proven otherwise.
