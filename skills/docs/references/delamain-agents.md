# Delamain Agent Authoring

Reference for writing state agents and sub-agents in a delamain bundle. Covers the agent file format, best practices, and patterns that have emerged from production use.

## Audience

ALS Developer, ALS Architect, Claude.

## Agent File Format

Agent files are markdown with YAML frontmatter:

```markdown
---
name: development-pipeline--planning
description: Handle items in the planning state.
tools: Read, Edit, Grep, Glob
model: sonnet
color: blue
---

You are the state agent for `planning` in the `development-pipeline` Delamain.

## Mission

One sentence describing what this agent does.

## Procedure

1. Step one.
2. Step two.
3. ...
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Agent identifier. Convention: `{delamain-name}--{state}` |
| `description` | Yes | One-line description for the dispatcher log |
| `tools` | No | Comma-separated tool list. Default: `Read, Edit` |
| `model` | No | `sonnet`, `opus`, or `haiku`. Default: `sonnet` |
| `color` | No | Display color hint |

### Body

The body is the agent's prompt. It is sent verbatim to the Agent SDK with runtime context appended.

## Runtime Context

The dispatcher appends a `## Runtime Context` section to every agent prompt at dispatch time:

```
---

## Runtime Context

item_id: GHOST-143
item_file: /path/to/GHOST-143.md
current_state: planning
date: 2026-04-06
resume: no
session_field: planner_session
session_id: null

legal_transitions:
- advance → plan-input
- advance → plan-ready
```

The agent uses this to know which item to operate on, what transitions are legal, and whether this is a fresh or resumed session.

## Best Practices

### 1. Idempotent Agents

Agents may be re-dispatched if the dispatcher restarts. Every agent must be safe to run twice on the same item in the same state.

**For direct dispatch** (agent does work via Agent SDK): this is naturally handled — the agent reads the item, checks state, and either acts or stops.

**For delegated dispatch** (agent spawns an external process): the agent must check whether the operation is already in progress before acting. Check reality, not state.

Example — checking if a tmux window already exists:

```bash
pane_cmd=$(tmux -L ghost-tree list-panes -t "ghost-tree:plan-{ITEM_ID}" -F '#{pane_current_command}' 2>/dev/null)
```

- No output → window doesn't exist → proceed
- Output is `codex` or `node` → already running → log and stop
- Output is `zsh` or `bash` → process finished or died → flag for operator

### 2. Delegated Dispatch

Some agents don't do work directly — they spawn an external process (e.g., a Codex session in tmux) and stop. This is the delegated dispatch pattern.

Key rules for delegated agents:
- **Check idempotency first** — verify the delegate isn't already running
- **The agent writes the session ID** — the dispatcher's auto-persist writes the wrong session (the orchestrator's, not the delegate's). The delegate must write its own session ID to the session field.
- **Fresh vs resume** — check `resume` and `session_id` from Runtime Context. If resuming, pass the session ID to the delegate (e.g., `codex resume {SESSION_ID}`).

The `delegated: true` field in `delamain.yaml` (GHOST-154) will formalize this by telling the dispatcher to skip Agent SDK resume and auto-persist for delegated states.

### 3. One Job Per Agent

Each state agent has exactly one job: perform the work for that state and choose the next transition. Don't combine multiple states' work into one agent.

- **Transition agents** (e.g., `queued.md`, `ready.md`): move the item to the next state. Minimal logic — read, validate, transition, log.
- **Work agents** (e.g., `planning.md`, `in-dev.md`): perform substantive work then transition based on the outcome.

### 4. Sub-Agents for Focused Work

When a state agent needs to perform a large unit of focused work, delegate to a sub-agent. The sub-agent:
- Does the scoped implementation work
- Reports results back to the parent
- Does NOT choose the next transition — only the parent state agent decides

### 5. Session Field Ownership

Session fields (`planner_session`, `dev_session`) are implicit — they exist on items but are not declared in `shape.yaml`. They are managed by the dispatcher (for direct dispatch) or the delegate (for delegated dispatch). Skills and agents should not create, modify, or validate session fields unless they are the delegate.

### 6. Agent Prompt Structure

Keep agent prompts focused:
- **Mission** — one sentence
- **Context** — only if the agent needs domain-specific knowledge (e.g., which apps live where)
- **Procedure** — numbered steps, each step is one action
- **App-specific sections** — only when the agent's behavior varies by domain (e.g., ALS vs default planning)

Avoid putting lifecycle rules in agent prompts. The legal transitions come from Runtime Context — the agent doesn't need to know the full state machine.
