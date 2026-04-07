# Delamain Dispatcher Reference

The dispatcher is a generic Bun application template that scans entity items and invokes Delamain-bound agents via the Claude Agent SDK. Its runtime identity comes from a compiler-generated `runtime-manifest.json` projected into each deployed Delamain bundle.

## Audience

ALS Developer, ALS Architect, Claude.

## Overview

The dispatcher template lives at `${CLAUDE_PLUGIN_ROOT}/skills/new/references/dispatcher/` and is copied into new Delamain bundles during module creation. Once copied, it runs without modification for any deployed Delamain bundle in any module.

When a Delamain bundle is deployed to `.claude/delamains/<name>/`, later `alsc deploy claude` runs preserve an existing `dispatcher/node_modules/` directory. Deploy itself does not install packages. If dependencies have never been installed in the deployed target, deploy warns and leaves installation as an explicit `bun install` step.

The deployed bundle root also receives `runtime-manifest.json`. That manifest is the authoritative binding contract for the runtime:

- which module mount path to scan
- which entity path template to match
- which frontmatter field is the Delamain-bound status field
- which discriminator field/value, if any, constrain the binding

The dispatcher is supported from deployed `.claude/delamains/<name>/` bundles. Running it directly from authored `.als/modules/.../delamains/.../dispatcher` is not part of the runtime contract because authored bundles do not carry the generated manifest.

## Source Files

### `src/index.ts`

Entry point. Handles:

- **System root discovery**: walks up directories from its own location looking for `.als/system.yaml`. Also respects the `SYSTEM_ROOT` environment variable.
- **Startup**: calls `resolve()` once to load `runtime-manifest.json`, local `delamain.yaml`, and state-agent files, then enters the poll loop.
- **Poll loop**: scans items at a configurable interval (`POLL_MS`, default 30s). Tracks active dispatches and releases items when their status changes.

### `src/watcher.ts`

Generic frontmatter parser and item scanner. Recursively walks the bound module root, matches concrete markdown file paths against the bound entity path template, and reads the Delamain-bound status field named in `runtime-manifest.json`.

### `src/dispatcher.ts`

The core logic. Two main functions:

**`resolve(bundleRoot, systemRoot)`** — loads the bundle-local runtime contract:

1. Reads `runtime-manifest.json` from the deployed Delamain bundle root
2. Reads local `delamain.yaml`
3. Loads state-agent and sub-agent markdown files from the same deployed bundle
4. Builds a dispatch table from `actor: agent` states

**`dispatch(itemId, itemFile, entry, agents, systemRoot)`** — invokes an agent:

1. Reads the agent's markdown file (frontmatter + body)
2. Composes the prompt: agent body + runtime context (item ID, current state, legal transitions)
3. Calls the Agent SDK `query()` directly with the agent's model, tools, and prompt
4. Handles direct and delegated session behavior: reads session metadata, resumes direct SDK sessions, and skips SDK resume plus auto-persist for delegated states
5. Passes sub-agents via the SDK `agents` parameter when the state declares `sub-agent`

### `src/runtime-manifest.ts`

Runtime manifest loader and validator.

- Reads `runtime-manifest.json` from the deployed bundle root
- Validates the manifest schema and required binding fields
- Fails closed with a redeploy message when the manifest is missing or malformed

### `src/session-runtime.ts`

Pure helper logic for session handling:

- Builds the runtime `resume`, `session_field`, and `session_id` contract from authored Delamain state data plus any stored session value
- Distinguishes direct SDK-resumable states from delegated externally managed worker sessions
- Centralizes the rule for whether the dispatcher should persist its own SDK session id

## How Configuration Is Derived

The dispatcher reads one generated runtime manifest plus the local Delamain bundle:

| What | Derived from |
|------|-------------|
| Module path | `runtime-manifest.json` → `module_mount_path` |
| Entity path template | `runtime-manifest.json` → `entity_path` |
| Status field | `runtime-manifest.json` → `status_field` |
| Variant discriminator | `runtime-manifest.json` → `discriminator_field` + `discriminator_value` |
| Legal states | Delamain primary definition → `states` |
| Dispatch rules | States where `actor: agent` and `path` is declared |
| Agent prompts | Markdown files at delamain-relative `path` |
| Legal transitions | Delamain primary definition → `transitions` filtered by source state |
| Session handling | State `resumable` + `delegated` + `session-field` |
| Sub-agents | State `sub-agent` path |

Hosts generate `runtime-manifest.json` during Claude projection. One deployed Delamain bundle owns exactly one effective binding. Reusing the same Delamain name across multiple effective bindings is a deploy-planning error.

## Path Resolution

Agent paths in `delamain.yaml` resolve relative to the directory containing the Delamain primary definition file (the deployed bundle root), not relative to the module bundle root.

The `findSystemRoot` walk-up in `index.ts` makes the dispatcher work at any nesting depth under a deployed `.claude/delamains/<name>/` bundle.

## Session Handling

Session fields are implicit — they are declared in `delamain.yaml`, not in `shape.yaml`.

### Direct resumable dispatch

States that declare `resumable: true` and omit `delegated` (or declare `delegated: false`) get automatic Agent SDK session persistence:

1. Before dispatch, the dispatcher reads the session field from item frontmatter.
2. If the stored value is a valid Agent SDK session id, it passes `resume: sessionId` to the SDK.
3. After a new SDK session completes, the dispatcher writes that SDK session id back to the item's frontmatter field.
4. On subsequent dispatches to the same state, the SDK session resumes where it left off.

### Delegated dispatch

States that declare `delegated: true` are treated as orchestrators for externally managed work:

1. The dispatcher still reads the authored `session-field` value when one exists.
2. The dispatcher exposes `session_field` and `session_id` in Runtime Context so the state agent can inspect or manage the delegated worker lifecycle.
3. The dispatcher does not pass `resume` to the Agent SDK for delegated states.
4. The dispatcher does not auto-persist the dispatcher-owned Agent SDK session id back into the item's `session-field`.

If a delegated state has no declared `session-field`, Runtime Context still includes `session_field: null` and `session_id: null`.

## Sub-Agent Handling

When a state declares `sub-agent: <path>`, the dispatcher:

1. Loads the sub-agent markdown file from the delamain-relative path.
2. Passes it via the SDK's `agents` parameter as a named agent definition.
3. Adds `Agent` to the parent agent's allowed tools so it can invoke the sub-agent.

The sub-agent does not choose transitions — only the parent state agent decides which transition to take.

## Running the Dispatcher

```bash
cd <delamain-bundle>/dispatcher
bun install
bun run src/index.ts
```

`bun install` is the bootstrap step for a new deployed dispatcher. It is not part of the normal redeploy contract once `dispatcher/node_modules/` already exists.

Environment variables:

- `SYSTEM_ROOT` — override the system root (optional; auto-detected by default)
- `POLL_MS` — polling interval in milliseconds (default: 30000)

If `runtime-manifest.json` is missing or invalid, the dispatcher fails closed and instructs the operator to redeploy the Delamain bundle.

## Dependencies

- `@anthropic-ai/claude-agent-sdk` — for `query()` calls
- `yaml` — for YAML parsing
- Bun runtime
