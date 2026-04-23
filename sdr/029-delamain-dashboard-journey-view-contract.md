# Delamain Dashboard Journey View Contract

## Status

Proposed

## Context

- The current `delamain-dashboard` web UI is a server-rendered dispatcher-card grid. It shows liveness and queue state but does not show the shape of a deployed Delamain.
- Operators need a first-class journey view so they can inspect states and transitions without opening authored TypeScript.
- The dashboard already consumes deployed bundle artifacts under `.claude/delamains/*`, especially `delamain.yaml` and `runtime-manifest.json`.
- The TUI, the bootup flow, and the current `bun run src/index.ts service --system-root ...` entrypoint depend on a single localhost service and should remain compatible in this landing.

## Decision

- `delamain-dashboard` keeps one localhost service and two web routes:
  - `/` remains the landing page.
  - `/journey/{delamainName}` becomes the journey-inspection route.
- The web UI is rebuilt as a React + TypeScript client that uses `@xyflow/react` for graph rendering.
- The only web build pipeline is Bun native bundling via `Bun.build()` at service start.
- Journey graph data comes from deployed bundle artifacts in `.claude/delamains/{name}`:
  - `delamain.yaml` supplies `phases`, `states`, and `transitions`.
  - `runtime-manifest.json` continues to supply bundle metadata already projected for runtime use.
- The dashboard must not dynamically import `delamain.ts` and must not traverse authored `.als/modules/**` trees to build the journey graph.
- `parseDelamainYaml` and the shared dispatcher snapshot contract extend additively so `transitions` are exposed with the authored shape `{ class, from, to }`.
- The dashboard snapshot schema string remains `als-delamain-dashboard-snapshot@1` in this landing.
- The landing page remains the initial hydration and SSE surface. Journey navigation is reached from the landing page instead of from a second standalone service.
- Journey rendering is generic:
  - phase columns follow declared `phases` order
  - node presentation derives from state metadata (`phase`, `actor`, `initial`, `terminal`)
  - edge presentation derives from transition `class`
- The shared graph contract may declare optional telemetry data for future overlays, but v1 does not render live-job overlays or other runtime styling from it.
- The TUI, the current CLI surface, and the localhost-only deployment model remain unchanged.

## Normative Effect

- Required: `GET /journey/{delamainName}` is a supported operator route and is reachable from the landing page for any discovered dispatcher.
- Required: the journey view consumes deployed compiled artifacts under `.claude/delamains/{name}` instead of authored-source imports or runtime TypeScript evaluation.
- Required: `transitions` mirror the authored Delamain transition shape exactly, including `from` fan-out arrays.
- Required: snapshot and SSE contract changes are additive only. Existing fields consumed by the TUI or current web clients are not renamed or removed.
- Required: the dashboard service builds the web bundle at startup and fails loudly if bundling fails.
- Required: the renderer works for any compiled Delamain the dashboard discovers. Hard-coded bundle names or per-module render logic are rejected.
- Allowed: node positioning may use xyflow-native placement or a companion layout helper so long as phase order and transition direction remain readable.
- Allowed: the shared graph contract may include an optional `telemetry` block that v1 ignores.
- Rejected: Vite, Webpack, Rollup, esbuild as a standalone build tool, or `tsc` emit as the web build pipeline.
- Rejected: dynamic `import()` of deployed or authored `delamain.ts` at dashboard runtime.
- Rejected: live telemetry overlay, TUI changes, authentication, multi-system support, or Delamain editing in this landing.

## Compiler Impact

- No new ALS authored syntax, validator rule, or deploy-time schema is introduced by this decision.
- `alsc deploy claude` continues to emit `delamain.yaml` and `runtime-manifest.json` in the compiled bundle shape the dashboard consumes.
- Dashboard-side tests must prove that the parser and snapshot builder stay aligned with the existing compiled Delamain contract, especially transition arrays and terminal-state exits.

## Docs and Fixture Impact

- Update dashboard docs and `bootup` references to describe the React web client, the journey route, and the unchanged TUI/CLI contract.
- Fixture review for the parser and graph contract should use deployed bundles already present in-tree: `als-factory-jobs`, `ghost-factory-jobs`, and `funnel-factory-jobs`.
- Operator validation for `general-purpose-factory-jobs` should run against the Foundry system root where that bundle is actually deployed rather than against this worktree's `.claude/delamains/`.
- Update any dashboard README or operator-facing docs that still describe the web UI as a server-rendered card grid only.
- The canonical shape-language reference does not change in this pass because no authored surface or language syntax changes.

## Alternatives Considered

- Read graph data by dynamically importing `.claude/delamains/{name}/delamain.ts`.
- Rejected because it couples the dashboard to runtime TypeScript evaluation and deploy-layout quirks when `delamain.yaml` already carries the needed graph data.
- Use `/journey/{module}/{delamain}` or `/d/{delamain}` as the route.
- Rejected because the dashboard already keys discovered bundles by Delamain name under a single `--system-root`, so extra path shape adds noise without removing ambiguity in this landing.
- Build the web bundle on first request instead of service start.
- Rejected because bootup should fail immediately when the bundle is broken rather than reporting a healthy service that only fails when the operator opens the page.
- Create a separate graph-only service or endpoint surface unrelated to the shared snapshot feed.
- Rejected because the current service already owns discovery, snapshot refresh, and SSE, and the journey view is an additive operator surface on that same runtime.

## Non-Goals

- Live telemetry overlay on graph nodes or edges.
- Any TUI redesign or behavior change.
- New CLI flags or multi-system routing.
- Editing Delamains from the dashboard.
