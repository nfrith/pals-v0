# Reference-System Autonomous Delamain Modules

## Status

Accepted

## Context

- The reference system is ALS's working proving ground, but today only `factory` demonstrates a Delamain-bound lifecycle.
- Several active reference-system modules already have clear lifecycle-shaped `status` fields and realistic authored records: `incident-response` v1, `infra` v1, `experiments` v2, and `postmortems` v1.
- The existing `factory` example is valuable, but it teaches a backlog-style mixed operator/agent pipeline rather than a fully autonomous non-terminal lifecycle.
- Operator direction for this item is explicit: the new reference-system examples should keep every non-terminal state agent-owned, use separate module-scoped operator console skills for monitoring and override, and stop short of compiler or language work if the current grammar is insufficient.
- Current ALS grammar still forbids `actor` on terminal states, so a fully autonomous first pass means all non-terminal states are `actor: agent` while terminal states remain actorless.

## Decision

- The reference system expands its canonical Delamain coverage beyond `factory` to four additional module/entity pairs:
  - `incident-response` v1 `incident-report.status`
  - `infra` v1 `release.status`
  - `experiments` v2 `run.status`
  - `postmortems` v1 `incident.status`
- Each target `status` field becomes `type: delamain` bound through the module bundle's `delamains` registry.
- The approved Delamain bundle names are:
  - `incident-lifecycle`
  - `release-lifecycle`
  - `run-lifecycle`
  - `postmortem-lifecycle`
- The approved first-pass state surfaces are:
  - `incident-lifecycle`: `active -> monitoring -> recovered -> closed`
  - `release-lifecycle`: `pending -> rolling-out -> active -> rolled-back | superseded`
  - `run-lifecycle`: `queued -> running -> completed | failed`
  - `postmortem-lifecycle`: `investigating -> mitigated -> resolved -> closed`
- Every non-terminal state in these four Delamains declares `actor: agent`, `resumable: false`, and a state `path`.
- None of these first-pass Delamains declare `session-field`, `delegated`, or `sub-agent`.
- Terminal states remain actorless because current ALS grammar forbids `actor` on terminal states.
- Each target module adds a separate module-scoped operator console skill for monitoring and override:
  - `incident-response-incident-lifecycle`
  - `infra-release-lifecycle`
  - `experiments-run-lifecycle`
  - `postmortems-incident-lifecycle`
- Existing CRUD and manual module skills remain in place. The new lifecycle console skills are additive.
- Representative authored examples must include at least one in-flight record for every target lifecycle. Existing in-flight examples may be reused, and missing ones must be added.

## Normative Effect

- Required: `incident-response` v1 binds `incident-report.status` to `incident-lifecycle`.
- Required: `infra` v1 binds `release.status` to `release-lifecycle`.
- Required: `experiments` v2 binds `run.status` to `run-lifecycle`.
- Required: `postmortems` v1 binds `incident.status` to `postmortem-lifecycle`.
- Required: the persisted status names for these first-pass examples match the approved state sets in the Decision section.
- Required: every non-terminal state in these four Delamains is `actor: agent` with `resumable: false`.
- Required: these four Delamains do not declare `session-field`, `delegated`, or `sub-agent`.
- Required: terminal states in these four Delamains remain actorless.
- Required: the reference system registers the four lifecycle console skills in `.als/system.yaml` alongside the pre-existing module skills.
- Required: the reference system includes representative records proving the new Delamain-bound states validate, including a non-terminal `run` example and a non-terminal `postmortems` example.
- Allowed: existing authored records that already use approved status names may remain unchanged when they continue to validate under the new Delamain binding.
- Allowed: the new lifecycle console skills act as monitoring and override surfaces rather than queue-driven operator-owned workflow states.
- Rejected: introducing operator-owned non-terminal states into these four first-pass reference-system Delamains.
- Rejected: attaching `actor` to terminal states in order to force a literally all-agent graph.
- Rejected: folding experiment funding-gate semantics into this item's first pass.
- Rejected: collapsing the new lifecycle console behavior into the existing CRUD/manual skills in this pass.

## Compiler Impact

- No new ALS grammar or compiler feature is introduced by this decision. The existing Delamain language from SDR 018, SDR 020, and SDR 021 must already be sufficient to express these examples.
- Validation must continue to enforce the existing terminal-state rule that terminal states do not declare `actor`.
- `alsc validate` and `alsc deploy claude` against `reference-system/` must succeed once the authored reference-system changes land.
- Compiler-facing tests that encode reference-system projection counts or assumptions about Delamain coverage must be updated to match the expanded authored fixture.

## Docs and Fixture Impact

- Update the canonical shape-language reference to show that Delamain does not require operator-owned non-terminal states and to add an autonomous lifecycle example alongside the mixed-ownership factory-style example.
- Update `reference-system/.als/system.yaml` so the new lifecycle console skills are live active skills for their modules.
- Update the target module bundles under `reference-system/.als/modules/incident-response/v1/`, `reference-system/.als/modules/infra/v1/`, `reference-system/.als/modules/experiments/v2/`, and `reference-system/.als/modules/postmortems/v1/` with Delamain registries, Delamain bundles, and lifecycle console skills.
- Update representative records under `reference-system/workspace/incident-response/`, `reference-system/infra/`, `reference-system/workspace/experiments/`, and `reference-system/operations/postmortems/` so the reference system proves the accepted lifecycle examples in authored data.
- Realign deploy and smoke tests that currently assume the full reference-system projects one Delamain and twenty skills.

## Alternatives Considered

- Keep `factory` as the only reference-system Delamain example.
- Rejected because the reference system should teach more than one workflow shape, especially autonomous non-terminal lifecycles.
- Add operator-owned attention states to the new module examples.
- Rejected because operator direction for this item requires autonomous non-terminal state ownership.
- Extend `experiments` with a funding lifecycle in the same pass.
- Rejected because the settled first pass is limited to `run.status`.
- Change ALS so terminal states may also declare `actor: agent`.
- Rejected because this item is reference-system authored-surface work, not a compiler or language change.

## Non-Goals

- Adding Delamains to modules outside the four approved first-pass targets.
- Introducing new compiler validation rules or new Delamain syntax.
- Reworking existing manual module skills into a shared multi-module lifecycle console.
- Adding resumable, delegated, or session-tracked behavior to these four first-pass examples.
