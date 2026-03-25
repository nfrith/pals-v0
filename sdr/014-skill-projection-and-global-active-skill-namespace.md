# Skill Projection And Global Active Skill Namespace

## Status

Accepted

## Context

- SDR 013 settled that ALS-authored skills live canonically under `.als/modules/<module_id>/vN/skills/<skill_id>/SKILL.md`.
- SDR 013 explicitly rejected treating harness directories such as `.claude/` as the authored source of truth.
- That left an operational gap: validated ALS skills were not directly usable by Claude Code, which discovers project skills from `.claude/skills/<skill_id>/SKILL.md`.
- The repo also lacked a settled rule for cross-module active skill-name collisions, even though Claude Code uses one flat project skill namespace.
- The staged-change workflow also lacked an authoritative place to declare the future active skill set when `vN+1` adds, removes, or renames skills without touching live `.als/system.yaml` yet.

## Decision

- Active skill ids in the live ALS system are globally unique across all active modules.
- Skill ids remain slug-based and are not required by the compiler to carry a module prefix.
- Authoring workflows default to generating canonical skill ids as `<module-id>-<base-skill-name>`.
- That prefix rule is workflow guidance, not a compiler-enforced syntax law.
- Workflow-generated ids should normalize redundant module wording once. For example, an `infra` module should default to `infra-provision`, `infra-deploy-release`, `infra-inspect`, and `infra-maintain`.
- Claude Code is the first supported harness projection target.
- Claude projection copies the full canonical skill directory for each active skill into `.claude/skills/<skill_id>/`.
- Claude projection is deterministic and idempotent: the projected directory contents are derived only from the canonical active ALS skill bundle and reruns on unchanged inputs produce no content diff.
- Generic Claude deployment may overwrite an existing target path for the targeted skill id.
- The `new` workflow must preflight `.claude/skills/<skill_id>/` collisions and stop for operator review before a first live deploy when a target already exists.
- The `change` workflow does not live-deploy `.claude/skills/`.
- The staged future active skill set for `vN+1` is declared by `vN+1/migrations/MANIFEST.md` through `skill_paths`.
- `skill_paths` is the authoritative staged future active skill set for that prepared bundle.
- The `migrate` workflow updates both the module `version` and module `skills:` in `.als/system.yaml` at cutover time.
- `migrate` is the only workflow allowed to delete projected Claude skill directories, and only for old active skill ids retired or renamed by that module cutover.

## Normative Effect

- Required: if two active modules declare the same live skill id, validation fails.
- Required: live active skill ids remain canonical ALS source identifiers and are the Claude projection target directory names in this phase.
- Required: the staged future active skill set for `vN+1` is recorded in `MANIFEST.md skill_paths`.
- Required: `migrate` updates `.als/system.yaml` `skills:` to match the staged future active skill set when the cutover lands.
- Allowed: workflow-generated skill ids may follow the default module-prefix convention without making that prefix mandatory for all valid ALS systems.
- Allowed: generic Claude deploy may overwrite an existing targeted skill directory.
- Rejected: keeping active skill ids only module-local while Claude projection relies on one flat project namespace.
- Rejected: inventing a separate authored harness manifest for Claude projection in this phase.
- Rejected: solving harness-specific frontmatter enrichment in the same decision as the projection bridge.

## Compiler Impact

- Add validation that rejects duplicate active skill ids across modules in one live ALS system.
- Add a Claude projection command and reusable library that project active canonical skill bundles into `.claude/skills/`.
- Keep projection overwrite behavior explicit and deterministic.
- Provide deploy-time support for empty-target preflight so `new` can block on existing `.claude/skills/<skill_id>/` paths before first live projection.

## Docs and Fixture Impact

- Update the canonical shape-language reference to describe globally unique live active skill ids and the default module-prefix naming guidance.
- Update `new`, `change`, and `migrate` workflow docs to reflect naming defaults, staged `skill_paths`, live skill cutover, and Claude projection behavior.
- Repaint example systems and skill-pattern examples to the default prefixed naming style where they currently rely on unprefixed or suffix-style names.
- Check in Claude projections under example-system `.claude/skills/` directories as downstream derived artifacts.
- Remove the temporary Claude-skills gap note once the repo absorbs its content.

## Alternatives Considered

- Keep skill ids only module-local and treat Claude collisions as purely ad hoc deploy-time problems.
- Rejected because the flat project skill namespace is a real part of the first supported harness contract.
- Require every ALS skill id to start with its module id.
- Rejected because that is stronger than needed for correctness and should remain workflow guidance unless future experience proves the stricter law is necessary.
- Add a projection-manifest ownership file under `.claude/`.
- Rejected for this phase because the current workflow intentionally accepts dangerous overwrite behavior during live deploy and keeps the first bridge minimal.

## Non-Goals

- Settling where harness-specific frontmatter fields live for Claude or future harnesses.
- Generalizing the first harness bridge into a multi-harness projection framework.

## Follow-Up

- Decide where harness-specific frontmatter fields are declared, validated, and surfaced during authoring.
- Revisit whether future harnesses should reuse canonical skill ids directly or introduce separate projected naming surfaces.
