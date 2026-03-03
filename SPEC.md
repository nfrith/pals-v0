# PALS v0 Spec (Working Draft)

Updated: 2026-03-02

## 1) Current Agreements

1. System model:
- Each module is its own filesystem tree.
- The module's interface is its skill (or skill + forked subagent execution).
- Skills own business logic for reads and writes.

2. Orchestrator role:
- Orchestrator is a router/detective.
- Orchestrator does not know internals of module storage shape.
- Orchestrator can call the wrong module and recover.

3. Module awareness:
- Modules should not require global knowledge of the whole system.
- Module responses should not prescribe which other module to call next.
- Routing decisions remain with orchestrator.

4. Cross-module semantics:
- Cross-module IDs are preferred over cross-module path coupling.
- Cross-module interpretation should be owned by the module that owns the data.

5. Interaction style:
- Human prompt is natural language.
- Orchestrator can forward prompt verbatim to a module skill/subagent.
- Module may return structured output to support deterministic orchestration.

## 2) Read Contract Direction (Without "Next Hop")

Each module read response should include a consistent shape, but no global routing advice.

Suggested response envelope:
- `answer`: module-owned interpretation/result.
- `evidence`: which records/files were used.
- `needs`: external facts required to complete stronger answer (fact-type only, not module routing).
- `confidence`: high/medium/low.
- `uncertainties`: assumptions, ambiguities, data quality issues.

Example `needs` values (module-local language):
- "experiment outcomes in last 30 days for experiment IDs X/Y"
- "risk classification for platform channel Z"

Important: `needs` expresses missing information categories, not "call module X" instructions.

## 3) Scenario Set (Concrete)

### Scenario A: Priority Selection (Backlog + Experiments)

Human prompt to orchestrator:
"Pick the next 2 stories in EPIC-42 using experiment outcomes from the last 30 days. Weight confidence and recency."

Flow:
1. Orchestrator forwards prompt to `backlog` skill (forked).
2. Backlog returns:
- candidate stories for EPIC-42
- local eligibility interpretation
- `needs`: latest experiment outcomes for referenced experiment IDs
- evidence paths
3. Orchestrator forwards original prompt + backlog output to `experiments` skill (forked).
4. Experiments returns:
- interpreted outcomes (confidence, freshness, caveats)
- evidence paths
5. Orchestrator forwards combined outputs back to `backlog` skill.
6. Backlog returns final ranked stories with rationale.
7. Orchestrator responds to human.

Why this fits current principles:
- No direct module-to-module calling.
- No module-level global system awareness required.
- Module semantics remain module-owned.

### Scenario B: Wrong Module First (Recovery Behavior)

Human prompt:
"Which stories should we accelerate this week based on experiments?"

Flow:
1. Orchestrator first calls `distribution` by mistake.
2. Distribution returns:
- minimal answer: out-of-scope for requested decision
- optional `needs` expressed as unknowns (e.g., "story candidate set required")
3. Orchestrator calls `backlog` then `experiments`.
4. Continues normal flow.

Requirement:
- Out-of-scope responses must be cheap, explicit, and non-destructive.

### Scenario C: Stale Experiment Data

Human prompt:
"Choose next stories for EPIC-42 using experiments."

Flow:
1. Backlog provides candidates + needs.
2. Experiments reports stale/inconclusive outcomes for all relevant IDs.
3. Backlog returns ranking with reduced confidence and a gating note:
- "Decision provisional due to stale experiment evidence."
4. Orchestrator surfaces decision + uncertainty, not fake precision.

Requirement:
- Uncertainty handling must be first-class output, not hidden prose.

## 4) Cross-Module Communication: Options

### Option 1: Orchestrator-Only Request/Response (No Events)

- All cross-module communication occurs synchronously via orchestrator call chaining.
- Simple mental model.
- Good for read-heavy and human-in-loop flows.

Pros:
- Lowest complexity.
- Easy to debug.

Cons:
- No durable inter-module event history.
- Weaker decoupling for async workflows.

### Option 2: Domain Events Only (Inside Module)

- Module emits domain events for internal state changes.
- Events are not public integration contracts.

Pros:
- Clarifies module internals and transitions.

Cons:
- Limited direct value for cross-module orchestration unless projected outward.

### Option 3: Integration Events Only (Cross-Module Contract)

- Module emits stable, external-facing events consumed by orchestrator or other modules.

Pros:
- Clear decoupling contract.
- Better path toward future network/service boundary.

Cons:
- Requires event contract governance/versioning.

### Option 4: Both (Domain + Integration)

- Domain events are internal truth.
- Integration events are curated/public projections derived from domain events.

Pros:
- Clean architecture.
- Scales best for future separation.

Cons:
- Highest complexity.
- Risk of over-engineering too early.

## 5) Recommendation for v0

For v0, start with:
1. Synchronous orchestrator-mediated request/response for reads and decisions.
2. Optional append-only integration event log only for high-value transitions.
3. Skip full domain-event layer initially.

Rationale:
- Preserves momentum.
- Avoids dual-event-complexity too early.
- Keeps path open to add domain events later if needed.

## 6) Minimal v0 Integration Event Shape (If Enabled)

Event fields (conceptual):
- `event_id`
- `event_type`
- `producer_module`
- `entity_id`
- `occurred_at`
- `payload`
- `correlation_id` (for orchestrated flow tracing)
- `causation_id` (optional)

Example event types:
- backlog: `story-ranked`, `story-state-changed`
- experiments: `experiment-outcome-updated`, `experiment-confidence-updated`

Storage approach:
- Append-only markdown or JSONL under module-owned `events/` directory.
- Treated as immutable log.

## 7) Open Decisions

1. Should module read outputs be hard-structured (strict schema) or semi-structured markdown template?
2. Should `needs` be standardized taxonomy or free text initially?
3. Do we require evidence paths for every claim, or only high-impact claims?
4. At what trigger do we introduce full domain+integration event split?
5. Should orchestrator keep a short-term working memory artifact between turns (e.g., per-request transcript file)?

## 8) Next Scenario Candidates

1. Write path with side effects:
- Backlog state change triggers an experiment planning task.

2. Conflict resolution:
- Experiments signal says "negative," but backlog policy forces urgency due to external deadline.

3. Multi-module chain:
- Backlog + experiments + distribution readiness constraints.

## 9) Additional Scenario Exercises

### Scenario D: Write With Side Effects (No Events)

Human prompt:
"Move STORY-311 to in-progress and make sure experiment planning is covered."

Flow:
1. Orchestrator calls `backlog` write skill.
2. Backlog updates STORY-311 and returns:
- write result
- side-effect need: "experiment plan required for STORY-311"
- confidence + uncertainties
3. Orchestrator calls `experiments` write skill with that side-effect context.
4. Experiments creates/updates planning record and returns result.
5. Orchestrator returns final response.

Pros:
- Very simple.
- Fully explicit in single request chain.

Cons:
- If step 4 fails, orchestrator must own compensation logic.
- No durable event trail unless explicitly written elsewhere.

### Scenario E: Write With Integration Events (Async-Friendly)

Human prompt:
"Move STORY-311 to in-progress."

Flow:
1. Orchestrator calls `backlog` write skill.
2. Backlog writes STORY-311 and appends integration event `story-state-changed`.
3. Orchestrator may finish user response immediately.
4. Later, orchestrator (or event-consumer worker) reads new events and calls `experiments` to create plan.

Pros:
- Better decoupling.
- Better for delayed/async side effects.
- Durable history of cross-module intent.

Cons:
- Requires event consumption/replay logic.
- Eventual consistency, not immediate consistency.

### Scenario F: Experiment Outcome Arrives Later (Natural Fit for Events)

Situation:
- Experiment run completes overnight without a human prompt.

Flow:
1. Experiments module records outcome and emits `experiment-outcome-updated` integration event.
2. Orchestrator event loop notices event.
3. Orchestrator calls backlog read/write flow to re-evaluate affected stories.
4. Backlog updates ranking or marks decision-review-required.

Why this matters:
- This is hard to model with pure synchronous request/response.
- Integration events provide clean trigger semantics.

### Scenario G: Wrong Call + Recovery + Auditability

Situation:
- Orchestrator routes to wrong module first, then recovers.

Desired behavior:
1. Wrong module returns out-of-scope quickly.
2. Orchestrator retries with better module.
3. Trace keeps a per-request chain (attempt 1 failed routing, attempt 2 succeeded).

Need:
- Correlation ID across subagent calls to debug routing quality over time.

## 10) Domain vs Integration Events in This Architecture

### Domain Events (internal)

Use when:
- You need rich lifecycle semantics inside a module.
- Multiple local reactions depend on one state change.

Do not expose domain events as cross-module contract by default.

### Integration Events (external)

Use when:
- Another module must react without tight runtime coupling.
- Async or delayed workflows are expected.
- You want future-safe behavior across network boundaries.

Treat integration events as curated outputs, not raw internal details.

### v0 Decision Heuristic

Emit integration events only for transitions that are:
1. Cross-module relevant.
2. Potentially async.
3. Expensive to recompute by polling.

If a flow is synchronous and human-in-loop in one turn, orchestrator chaining is enough.

## 11) Practical Guardrails for v0

1. Keep module read/write responses in a stable template.
2. Keep `needs` module-local and fact-oriented.
3. Keep cross-module references as IDs, not file paths.
4. Require a correlation ID per orchestrated request chain.
5. Start with 2-4 integration event types only; avoid event proliferation.
6. Prefer explicit orchestrator retries over hidden auto-magic.

## 12) Questions For Next Iteration

1. Which exact backlog transitions should emit integration events in v0?
2. Which experiment transitions should emit integration events in v0?
3. Should event storage be JSONL-first or markdown-first?
4. Do we want one shared event log per module or per-entity event streams?
5. What is the minimum retry policy for orchestrator misroutes and transient failures?

## 13) Reference Encoding (Cross-Module IDs)

### Decision

Use standard markdown link syntax for cross-module references, but with transport-agnostic logical URIs in link targets.

Canonical format:
- `[display-label](ghost://<module>/<opaque-primary-id>)`

Example:
```yaml
---
people:
  - "[nick-frith](ghost://people/PPL-000123)"
  - "[sarah-chen](ghost://people/PPL-000456)"
---
```

### Why This Choice

1. Transport-agnostic by design.
- Filesystem now: resolve URI -> local module path.
- HTTP/service later: resolve URI -> module endpoint/read contract.
- Same stored reference, different resolver implementation.

2. Reduced coupling.
- No embedded filesystem paths across module boundaries.
- Module internal tree can be refactored without breaking external reference strings.

3. Lower drift surface.
- Keep relation payload minimal in referencing records.
- Avoid duplicating rich relationship metadata in many places.

4. Easy compiler/linter enforcement.
- Markdown link parse check.
- Allowed scheme check (`ghost://`).
- Module namespace check.
- Opaque ID format check.
- Existence/resolution check.

### Canonicality Rules

1. Canonical truth is the URI target, not the display label.
2. Opaque primary IDs are required in URI targets (no slug-as-key in canonical target).
3. Display labels are human-facing and may be soft-validated only.

### Non-Goals for v0

1. No rich inline relation objects as default reference form.
2. No path-coupled references as canonical FK mechanism.

## 14) Module Evolution and Versioning

### Decision

Every module declares explicit version metadata and compatibility policy.

Minimum fields (in `MODULE.md` or equivalent):
- `module_id`
- `module_version`
- `schema_version`
- `compat.read_versions`
- `compat.write_version`
- `compat.sunset_by` (optional but recommended)

### Compatibility Window Policy

1. During evolution windows, reads may support old + new versions.
2. Writes target the new version only.
3. Linter severity escalates by time/stage:
- `warn` during introduction
- `error` after required/cutover point

### Evolution Classes

1. Additive change
- Example: add a new section/field.
- Default strategy: phased rollout.

2. Shape change (move/rename/restructure)
- Example: `body.media` moved under another section.
- Default strategy: `expand -> migrate -> contract`.

3. Semantic change (meaning changes)
- Example: field meaning changes from label to computed score.
- Requires explicit version bump and compatibility window.

## 15) Body Structure and Null Semantics

### Decision

Markdown body structure is part of schema, not free-form prose.

v1 enforcement model:
1. Enforce section presence/shape contract first.
2. Defer deep typed parsing of section internals unless needed.

### Required vs Missing vs Empty

Treat as three distinct states:
1. Present with value.
2. Present and explicitly empty (canonical null marker).
3. Missing.

Rules:
1. Required sections must be present, even when empty.
2. Missing required section is a schema violation (or temporary legacy during compatibility window).
3. Explicit empty must use one canonical marker (default: `_none_`).

### Add-New-Section Process

1. Introduce as optional.
2. Require explicit presence in all new writes (use empty marker if no value).
3. Backfill existing records incrementally (lazy-on-touch + optional batch pass).
4. Promote to required and enforce with linter error at cutover.

## 16) Compiler Responsibilities (Separation of Concerns)

### Decision

Do not build one monolithic linter. Split responsibilities:

1. Normalizer
- Parse frontmatter + markdown sections.
- Resolve layout aliases into canonical schema keys.

2. Linter
- Validate canonical model against schema + compatibility policy.
- Enforce references, required fields/sections, enums, state transitions.

3. Migrator
- Apply record rewrites/backfills.
- Operates from explicit evolution rules.

### Why

- Keeps complexity bounded.
- Avoids embedding transformation logic directly in lint checks.
- Makes large module updates auditable and repeatable.

## 17) Delivery Scope (v1 vs Later)

### v1 (Target)

1. Orchestrator request/response chaining is the primary cross-module mechanism.
2. Transport-agnostic references with `ghost://<module>/<opaque-id>`.
3. Additive evolution support (including required explicit empty section markers).
4. Shape-change support via alias + cutover rules.
5. Minimal migrator for deterministic rewrites.

### Later

1. Full semantic-change tooling automation.
2. Broader domain-event modeling (if needed).
3. Advanced body-content typing and richer schema introspection.

## 18) Decision Log Snapshot (2026-03-02)

1. Orchestrator is the detective/router; modules do not prescribe global routing.
2. Module interfaces are skills/subagents; orchestration handoffs remain natural-language-first.
3. Cross-module references use markdown links with transport-agnostic URI targets.
4. Canonical FK truth is opaque ID in URI target, not display label.
5. Keep relation payload minimal to reduce drift.
6. Prefer synchronous orchestrator chaining for v1; add integration events selectively for async/high-value transitions.
7. Treat body section structure as schema; enforce explicit empty vs missing semantics.
8. Support three evolution classes with different strategies (additive, shape, semantic).
9. Separate normalizer/linter/migrator responsibilities.

## 19) Backlog Evolution Playbook (Epic/Story -> Initiative/Epic/Story)

### Purpose

Define one concrete, repeatable evolution procedure for the backlog module when introducing `initiative` above `epic`.

### Baseline and Target

Baseline (v1):
- Hierarchy: `epic -> story`
- Story record requires `epic_ref`

Target (v2):
- Hierarchy: `initiative -> epic -> story`
- Story record requires both `initiative_ref` and `epic_ref`
- Epic record requires `initiative_ref`

### Canonical References

Use transport-agnostic references only:
- `ghost://backlog/INIT-<id>`
- `ghost://backlog/EPIC-<id>`
- `ghost://backlog/STORY-<id>`

### Module Version Contract (Example)

```yaml
module_id: backlog
module_version: 2
schema_version: 2.0
compat:
  read_versions: [1, 2]
  write_version: 2
  sunset_by: 2026-06-30
```

### Phase Plan

#### Phase 0: Prepare

1. Add initiative schema and directory.
2. Add compatibility policy in module metadata.
3. Add linter rules in `warn` mode for upcoming required fields.

Exit criteria:
- New schema loads successfully.
- No blocking lint errors introduced by prep changes.

#### Phase 1: Expand (Dual-Read Starts)

1. Read logic supports old and new shapes.
2. Write logic begins writing v2 shape for all new/updated records.
3. `initiative_ref` is optional for legacy records but required for new writes.

Lint state:
- Missing `initiative_ref` on legacy story/epic: `warn`
- Invalid reference format: `error`

Exit criteria:
- All new writes include `initiative_ref`.
- Legacy read behavior remains stable.

#### Phase 2: Backfill

Run two backfill paths in parallel:

1. Lazy-on-touch backfill
- Any record edited by module skill gets normalized to v2.

2. Batch backfill
- Deterministic migrator processes remaining v1 records.

Required backfill outputs:
- Per-record result (`updated`, `skipped`, `failed`)
- Reason for failures
- Retry list

Lint state:
- Missing `initiative_ref` remains `warn`
- Invalid/missing target references remain `error`

Exit criteria:
- Backfill coverage >= agreed threshold (recommended: 100% for epics, >= 95% stories before cutover)
- Retry list is small and actionable.

#### Phase 3: Cutover

1. Flip requiredness:
- `initiative_ref` required on stories and epics.

2. Flip linter severities:
- Missing `initiative_ref`: `error`
- Any v1-only shape usage in writes: `error`

3. Keep dual-read for short stabilization window.

Exit criteria:
- No new v1-shape writes.
- Operational flows pass with strict v2 writes.

#### Phase 4: Contract and Cleanup

1. Remove v1 write paths.
2. Remove read compatibility for v1 after `sunset_by`.
3. Remove temporary alias/compat code.

Exit criteria:
- `read_versions: [2]`
- Migration marked complete.

### Linter Rule Timeline (Concrete)

Example rules:

1. `BKL-REF-001` reference target must be valid `ghost://` URI.
- Always `error`.

2. `BKL-EVO-001` `initiative_ref` missing on story.
- Phase 1-2: `warn`
- Phase 3+: `error`

3. `BKL-EVO-002` `initiative_ref` missing on epic.
- Phase 1-2: `warn`
- Phase 3+: `error`

4. `BKL-EVO-003` v1-only write shape detected.
- Phase 1-2: `warn`
- Phase 3+: `error`

### Backfill Process Contract

Backfill must be:
1. Deterministic.
2. Idempotent.
3. Restart-safe.

Recommended mechanics:
1. Generate candidate list from linter findings.
2. Apply transform rule set.
3. Validate transformed record immediately.
4. Persist with per-record status log.
5. Re-run until no actionable records remain.

### Failure Handling

If mapping story/epic to initiative is ambiguous:
1. Mark record `failed` with explicit reason.
2. Do not guess silently.
3. Route failed set to manual resolution queue.

### Orchestrator/Skill Behavior During Window

1. Orchestrator remains unchanged.
2. Backlog skill handles compatibility and normalization internally.
3. Cross-module callers only see stable backlog output contract.

### Definition of Done

1. All active records are v2-compliant.
2. Linter runs in strict mode for v2 requirements.
3. Backlog write path only emits v2 shape.
4. Compatibility code for v1 is removed.
5. Migration report is archived with counts and failure resolutions.

## 20) Body Shape-Change Playbook (Section Move Example: `## Media`)

### Purpose

Define a concrete procedure for a markdown body section move/rename without breaking module reads.

Example change:
- Old shape: top-level `## Media`
- New shape: nested under `## Assets` as `### Media`

### Canonical Schema Key

Treat both layouts as one canonical key during compatibility window:
- Canonical key: `body.media`

Interpretation rule:
1. Old layout (`## Media`) maps to `body.media`.
2. New layout (`## Assets` -> `### Media`) maps to `body.media`.

### Phase Plan

#### Phase 0: Introduce Alias Mapping

1. Add normalizer alias rules for both old and new layouts.
2. Keep linter non-blocking for old layout.

Lint state:
- Both shapes accepted.
- If both appear in same file, flag conflict (`error`) unless content is identical.

Exit criteria:
- Parser/normalizer resolves both layouts to same canonical key.

#### Phase 1: New-Write Preference

1. Module write logic emits new layout only.
2. Existing files may remain old layout.

Lint state:
- Old layout in unchanged legacy files: `warn`
- Old layout in newly written/rewritten files: `error`

Exit criteria:
- All skill-generated writes use new layout.

#### Phase 2: Backfill

1. Run migrator to rewrite old layout -> new layout.
2. Validate canonical equivalence after rewrite.

Backfill guarantees:
- Deterministic transform.
- Idempotent re-run behavior.
- Per-file status log.

Exit criteria:
- Remaining old-layout files are only known exceptions.

#### Phase 3: Cutover

1. Remove old-layout acceptance from linter.
2. Keep short read-only compatibility toggle if needed for rollback.

Lint state:
- Old layout anywhere: `error`

Exit criteria:
- No old-layout sections remain in active records.

#### Phase 4: Cleanup

1. Remove alias mapping and compatibility toggle.
2. Keep migration note in module changelog for auditability.

### Conflict and Ambiguity Rules

1. If file has both old and new layout with different content, fail lint (`error`).
2. Migrator must not guess merge outcomes for conflicting content.
3. Conflicts are routed to manual resolution queue.

### Null/Empty Handling During Move

1. Empty content remains explicit using canonical empty marker (`_none_`).
2. Missing required section after move is still a schema violation.

### Definition of Done

1. All active files use new layout.
2. Linter rejects old layout.
3. Alias mapping removed.
4. Migration/conflict report archived.
