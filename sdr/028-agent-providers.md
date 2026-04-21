# Delamain Agent Providers

## Status

Accepted

## Context

- SDR 020 established state-bound Delamain agents with resumable session fields and prompt assets stored beside the Delamain bundle.
- SDR 021 introduced `delegated: true` so a Claude-authored state agent could launch an external worker such as Codex through tmux and shell orchestration.
- That delegated shape proved to be the wrong abstraction for Codex work. The real distinction is not "delegated or not"; it is which provider runtime the authored prompt targets.
- Codex-authored prompts differ materially from Claude-authored prompts: different frontmatter, different skill-call syntax, different session identity shape, and different runtime controls for sandboxing and approvals.
- ALS now has direct provider-native dispatcher adapters for `@anthropic-ai/claude-agent-sdk` and `@openai/codex-sdk`, so the language needs a first-class provider declaration on every agent-owned state.

## Decision

- Every non-terminal `actor: agent` state declares exactly one `provider`.
- The v1 provider registry is `anthropic | openai`.
- `provider` lives on the state entry in `delamain.ts`. There is no Delamain-level default and no prompt-local override.
- Operator-owned and terminal states do not declare `provider`.
- `delegated` is removed from the Delamain state surface and is rejected everywhere.
- The dispatcher chooses the provider adapter solely from the state's declared `provider`.
- Runtime manifests project provider metadata through `state_providers` so deployed dispatchers can dispatch without re-reading authored source.
- Stored `session_id` values remain opaque provider-owned identifiers. Anthropic may persist SDK session ids; OpenAI may persist Codex thread ids.
- Prompt authoring is provider-native and non-portable:
  - Anthropic-authored prompts use Claude-style surfaces such as `tools`, Claude model aliases, and `/skill` references in the prompt body.
  - OpenAI-authored prompts use Codex-style surfaces such as `sandbox-mode`, `approval-policy`, optional `reasoning-effort`, optional `network-enabled`, codex model ids, and `$skill` references in the prompt body.
- Mixed-provider Delamains are allowed. Provider choice is per state, not per Delamain.
- OpenAI-authored states do not use ALS `sub-agent` prompt bindings in this landing.
- Runtime observability is part of the contract:
  - the dispatcher tick log includes the active provider breakdown
  - per-dispatch log records include `provider=...`
- Resume remains allowed for both providers. If a provider cannot continue a stored session directly after a long gap or process restart, the adapter may compensate with a context-carrying re-init flow instead of weakening the language contract.

## Normative Effect

- Required: every non-terminal `actor: agent` state declares `provider: "anthropic"` or `provider: "openai"`.
- Required: operator-owned and terminal states do not declare `provider`.
- Required: hosts treat the state's declared `provider` as the sole selector for native SDK dispatch.
- Required: runtime manifests preserve state-level provider metadata for deployed dispatchers.
- Required: stored session identifiers are treated as opaque provider-owned strings.
- Required: Anthropic-authored prompts use Anthropic-compatible prompt surfaces; OpenAI-authored prompts use OpenAI-compatible prompt surfaces.
- Required: the compiler rejects cross-provider prompt syntax, including:
  - `/skill` references in OpenAI-authored prompts
  - `$skill` references in Anthropic-authored prompts
  - Anthropic-only frontmatter on OpenAI-authored prompts
  - OpenAI-only frontmatter on Anthropic-authored prompts
- Required: OpenAI-authored states do not declare `sub-agent`.
- Required: the dispatcher logs provider identity in the tick line and in per-dispatch records.
- Allowed: one Delamain may mix Anthropic and OpenAI states.
- Allowed: resumable states may use either provider.
- Rejected: implicit provider defaults.
- Rejected: `delegated` as an authored Delamain field.
- Rejected: provider declarations on operator-owned or terminal states.
- Rejected: Claude-wrapper shell hops as the runtime contract for OpenAI-authored prompts.

## Compiler Impact

- Extend Delamain state parsing so agent-owned states require explicit `provider` and non-agent states reject it.
- Remove `delegated` from the accepted Delamain state schema and fail closed when it appears.
- Validate prompt assets against the declared provider contract, including provider-specific frontmatter and skill-call syntax.
- Preserve provider metadata in compiler outputs, including `runtime-manifest.json`.
- Treat session ids as opaque strings in runtime and validation layers instead of assuming a UUID-only format.
- Add coverage for:
  - valid Anthropic and OpenAI state declarations
  - missing `provider` on agent-owned states
  - `provider` on operator-owned or terminal states
  - forbidden `delegated`
  - provider-specific prompt validation failures

## Docs and Fixture Impact

- Update the canonical shape-language reference to document required state-level `provider`, the allowed provider set, and the removal of `delegated`.
- Update Delamain agent and dispatcher references to describe provider-native authoring, provider-specific prompt surfaces, opaque session ids, provider-aware logging, and adapter-based dispatch.
- Migrate authored Delamain manifests and provider-authored prompt files in active Ghost bundles and the reference system in one atomic change.
- Refresh deployed `.claude/delamains/**` projections from authored source after the migration.
- Keep worked examples aligned with the provider-native surface, including side-by-side Claude-authored and Codex-authored agent examples.

## Alternatives Considered

- Keep `delegated` and layer `provider` on top.
- Rejected because two fields would describe one runtime choice and preserve the wrong shell-hop abstraction.
- Make `provider` optional with an implicit Anthropic default.
- Rejected because the migration is atomic and authored prompts must declare which native surface they target.
- Declare `provider` once per Delamain.
- Rejected because mixed-provider Delamains are valid and already present in active authored systems.
- Infer provider from prompt prose or frontmatter.
- Rejected because compiler diagnostics and runtime dispatch must not depend on heuristic interpretation.

## Supersedes

- `021-delamain-delegated-state-dispatch.md`
