# ALS (Agent Language Specification)

ALS is a strict specification language for defining personal agent systems. It is based on the creator's (Nicholas Frith) experience working with personal agent systems going back to mid-2025.

## Profiles

### Operator

The end user. Uses a Claude harness (Claude Code, Cowork) on a project that happens to be an ALS system. May not be technical. May never invoke ALS skills directly — they interact with the system through skills that were built for them. Their most common ALS touchpoint is `/run-delamains` to start their pipelines.

### ALS Developer

Builds ALS systems for operators. Knows the spec. Uses `/new`, `/change`, `/migrate` to create and evolve modules. May package and distribute modules for operators to install.

### ALS Architect

Alters the language itself. Architects the spec, writes SDRs, evolves the compiler, defines new language constructs. Currently: Nicholas Frith.

### Claude

Present with all of the above. Enables each profile to do whatever they aim to do — from answering operator questions to authoring modules to implementing spec changes.

## Project Status

- This project is under active development and is not officially released yet.
- ALS is not being used in any production environment yet.

## Current Focus

- **v1 is the current focus.** Lessons from v0 were applied — several hard-to-implement features like skill/app management and migrations were removed from the initial scope. They will be reintroduced into v1 later.
- v0 has been removed from this repo.
- The working reference implementation is `reference-system/`. The compiler is being built to match this intended solution.

## Rules

- The SDR process defined in `sdr/AGENTS.md` must be followed when recording spec decisions.
- We are building this system to scale. It is not meant for startup go-fast mode.
