# Delamain Claude Projection Preserves Dispatcher Node Modules

## Status

Accepted

## Context

- SDR 014 settled Claude projection for active skills under `.claude/skills/` and intentionally allowed direct overwrite of those targets as the minimal first bridge.
- SDR 018 and SDR 020 settled Delamain bundles, their dispatcher assets, and their downstream Claude projection path under `.claude/delamains/<delamain-name>/`.
- The current deploy implementation reuses one destructive directory-overwrite helper for both Claude skills and Delamain bundles.
- That behavior deletes `.claude/delamains/<name>/dispatcher/node_modules/`, which leaves an already-installed dispatcher unrunnable until `bun install` is rerun manually.
- Operator direction for this decision is explicit: after deploy the dispatcher must still be runnable without an extra bootstrap step, deploy must remain a filesystem projection only, the guaranteed preserved path is `dispatcher/node_modules/`, and broader deploy scoping by module is separate work.

## Decision

- Claude projection of an active Delamain bundle still targets `.claude/delamains/<delamain-name>/`.
- When that target already contains `dispatcher/node_modules/`, Claude projection preserves that directory during deploy.
- Claude projection refreshes authored Delamain bundle files from the active canonical source bundle.
- Claude projection remains a filesystem projection only and does not run `bun install` or any other package-manager command.
- This preservation rule is generic for Delamain bundles. It is not Ghost-specific.
- Hosts may use merge-based projection to satisfy this contract, and that means authored files no longer present in source may remain in the deployed target after refresh.
- Broader runtime-path preservation is not part of this decision. Files such as `status.json` may survive as side effects of merge behavior, but deploy does not guarantee their preservation.

## Normative Effect

- Required: if `.claude/delamains/<name>/dispatcher/node_modules/` exists before deploy, it remains available after deploy.
- Required: Delamain deploy does not force a manual `bun install` step just because projection deleted installed dispatcher dependencies.
- Required: deploy refreshes authored Delamain files from the canonical active bundle.
- Required: deploy does not invoke package-manager commands.
- Required: missing `dispatcher/node_modules/` at projection time produces a warning and does not fail deploy.
- Allowed: merge-based projection may leave stale authored files that are no longer present in source.
- Allowed: incidental runtime files outside `dispatcher/node_modules/` may remain in the target as side effects of merge-based projection.
- Rejected: destructive Delamain projection that removes installed dispatcher dependencies on every deploy.
- Rejected: treating manual post-deploy `bun install` as part of the normal Delamain deploy contract.
- Rejected: guaranteeing preservation of every runtime file under `.claude/delamains/<name>/` in this pass.

## Compiler Impact

- Split Delamain projection behavior from generic Claude skill projection so `.claude/skills/` keeps the overwrite semantics already accepted in SDR 014 while Delamain projection preserves `dispatcher/node_modules/`.
- Update `alsc/compiler/src/claude-skills.ts` so Delamain projection refreshes authored files without deleting preserved dispatcher dependencies.
- Surface the missing-`node_modules` warning through the deploy command without failing projection.
- Add deploy coverage proving preserved dispatcher dependencies survive repeat deploys and that merge-based Delamain projection may leave stale files.

## Docs and Fixture Impact

- Update the canonical shape-language reference to describe Delamain Claude projection as a downstream runtime artifact, the preserved `dispatcher/node_modules/` contract, the no-package-manager rule, and the possible stale-file side effect of merge-based projection.
- Use deploy target trees and `alsc/compiler/test/deploy.test.ts` as the fixture surface for this decision. No new `shape.yaml` or `delamain.yaml` syntax is introduced.
- Realign supporting Delamain docs such as `module-integration.md`, `delamain-overview.md`, and `delamain-dispatcher.md` during implementation so they match the accepted contract.

## Alternatives Considered

- Keep destructive target replacement for Delamain projection.
- Rejected because it makes an installed dispatcher unrunnable after every deploy.
- Preserve all runtime-owned files under the Delamain target.
- Rejected because operator direction narrowed the explicit contract to `dispatcher/node_modules/` only.
- Run `bun install` during deploy.
- Rejected because deploy must remain a pure filesystem projection with no package-manager side effects.
- Require prune semantics that guarantee no stale authored files remain.
- Rejected for this pass because the operator explicitly allowed merge-based behavior when that is the simplest way to preserve installed dependencies.

## Non-Goals

- Changing module-filter scope so deploy touches only one affected module.
- Defining a general runtime-artifact preservation registry beyond `dispatcher/node_modules/`.
- Reworking Claude skill projection semantics under `.claude/skills/`.
