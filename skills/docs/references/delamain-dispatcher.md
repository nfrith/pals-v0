# Delamain Dispatcher Reference

The dispatcher is a generic Bun application template that scans entity items and invokes Delamain-bound agents via the Claude Agent SDK. It requires zero configuration — everything is derived from the ALS declaration surface.

## Audience

ALS Developer, ALS Architect, Claude.

## Overview

The dispatcher template lives at `${CLAUDE_PLUGIN_ROOT}/skills/new/references/dispatcher/` and is copied into new delamain bundles during module creation. Once copied, it runs without modification for any delamain in any module.

## Source Files

### `src/index.ts`

Entry point. Handles:

- **System root discovery**: walks up directories from its own location looking for `.als/system.yaml`. Also respects the `SYSTEM_ROOT` environment variable.
- **Startup**: calls `resolve()` once to crawl the ALS declaration surface, then enters the poll loop.
- **Poll loop**: scans items at a configurable interval (`POLL_MS`, default 30s). Tracks active dispatches and releases items when their status changes.

### `src/watcher.ts`

Generic frontmatter parser and item scanner. Reads markdown files from the items directory and extracts `id` and `status` from YAML frontmatter. No ALS-specific knowledge — a pure filesystem scanner.

### `src/dispatcher.ts`

The core logic. Two main functions:

**`resolve(systemRoot)`** — crawls the ALS declaration surface:

1. Reads `system.yaml` → iterates all modules to find one with a delamain
2. Reads `shape.yaml` → finds the entity (or variant) with a `type: delamain` field. Supports discriminated variants — when the delamain field is inside a variant, records the discriminator field and value for item filtering.
3. Reads the delamain primary definition file → loads states, transitions, agent files
4. Builds a dispatch table from `actor: agent` states

**`dispatch(itemId, itemFile, entry, agents, systemRoot)`** — invokes an agent:

1. Reads the agent's markdown file (frontmatter + body)
2. Composes the prompt: agent body + runtime context (item ID, current state, legal transitions)
3. Calls the Agent SDK `query()` directly with the agent's model, tools, and prompt
4. Handles direct and delegated session behavior: reads session metadata, resumes direct SDK sessions, and skips SDK resume plus auto-persist for delegated states
5. Passes sub-agents via the SDK `agents` parameter when the state declares `sub-agent`

### `src/session-runtime.ts`

Pure helper logic for session handling:

- Builds the runtime `resume`, `session_field`, and `session_id` contract from authored Delamain state data plus any stored session value
- Distinguishes direct SDK-resumable states from delegated externally managed worker sessions
- Centralizes the rule for whether the dispatcher should persist its own SDK session id

## How Configuration Is Derived

The dispatcher never reads a config file. Everything comes from the ALS declaration surface:

| What | Derived from |
|------|-------------|
| Module path | `system.yaml` → module entry → `path` |
| Items directory | Module path + entity path template dirname |
| Status field | Entity field with `type: delamain` |
| Legal states | Delamain primary definition → `states` |
| Dispatch rules | States where `actor: agent` and `path` is declared |
| Agent prompts | Markdown files at delamain-relative `path` |
| Legal transitions | Delamain primary definition → `transitions` filtered by source state |
| Session handling | State `resumable` + `delegated` + `session-field` |
| Sub-agents | State `sub-agent` path |

## Path Resolution

Agent paths in `delamain.yaml` resolve relative to the directory containing the delamain primary definition file (the delamain bundle root), not relative to the module bundle root. This enables deployment to `.claude/delamains/` without path rewriting.

The `findSystemRoot` walk-up in `index.ts` makes the dispatcher work at any nesting depth — whether running from the original `.als/modules/` location or from a deployed `.claude/delamains/` location.

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

Environment variables:

- `SYSTEM_ROOT` — override the system root (optional; auto-detected by default)
- `POLL_MS` — polling interval in milliseconds (default: 30000)

## Dependencies

- `@anthropic-ai/claude-agent-sdk` — for `query()` calls
- `yaml` — for YAML parsing
- Bun runtime
