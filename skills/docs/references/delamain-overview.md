# Delamain Overview

Delamains are Phase-Constrained Transition Graphs — formalized workflow engines that govern how entities move through lifecycle states. The name is a convenience label; the underlying construct is a state machine with phase groupings, actor ownership, and agent bindings.

## Audience

All profiles — Operator, ALS Developer, ALS Architect, Claude.

## Core Concepts

### States

Every state in a delamain has:

- **Phase** — a logical grouping (e.g., `intake`, `planning`, `implementation`, `deployment`, `closed`). Phases impose ordering on the state graph but don't enforce transitions.
- **Actor** — either `operator` or `agent`. Determines who owns the state. Operator states wait for human action. Agent states are dispatched automatically.
- **Terminal** — optional. Terminal states have no outbound transitions. Items that reach a terminal state are done.

### Transitions

Transitions connect states. Each transition has:

- **Class** — `advance` (forward progress), `rework` (return to earlier state), or `exit` (move to terminal).
- **From** — one or more source states.
- **To** — the target state.

Only legal transitions are allowed. An agent or operator can only move an item to a state that has a declared transition from the current state.

### Phases

Phases group states into logical stages. They exist for human readability and reporting — they don't enforce transition rules. A transition can cross phase boundaries.

### Agent Bindings

States with `actor: agent` declare:

- **path** — the agent markdown file (relative to the delamain bundle root)
- **resumable** — whether the dispatcher should resume a previous session
- **session-field** — the frontmatter field that stores the session ID for resume
- **sub-agent** — optional path to a sub-agent markdown file

### Operator States

States with `actor: operator` have no agent binding. They represent wait points where the human decides what happens next. The operator console skill surfaces items in operator states and presents context actions.

## The Delamain Bundle

A delamain is a directory containing:

```
development-pipeline/
├── delamain.yaml           # phases, states, transitions
├── agents/
│   ├── queued.md           # one per agent-owned state
│   ├── planning.md
│   └── ...
├── sub-agents/
│   └── developer.md        # optional helpers
└── dispatcher/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── dispatcher.ts
        └── watcher.ts
```

The delamain bundle is self-contained. It can live in `.als/modules/{module}/v{N}/delamains/` and is deployed to `.claude/delamains/` by the compiler.

## How It Runs

1. The operator starts the dispatcher (via `/run-delamains` or manually).
2. The dispatcher polls the items directory for entities in agent-owned states.
3. When an item is found, the dispatcher reads the state's agent file and invokes it via the Agent SDK.
4. The agent performs its work and transitions the item to the next state.
5. On the next tick, the dispatcher sees the new state and dispatches the appropriate agent — or stops if the state is operator-owned or terminal.

The operator interacts with items in operator-owned states through the pipeline console skill.

## Event-Driven, Not Polling

While the dispatcher technically polls the filesystem, the system is event-driven from the operator's perspective. Agents run when work exists. No heartbeat daemon burns tokens in the background. The operator is the heartbeat.

## Discriminated Variants

When an entity uses a discriminator (e.g., `type: app` vs `type: infra`), only the variant with a `type: delamain` status field participates in the pipeline. The dispatcher filters items by the discriminator value, ignoring items of other variants.
