# Compiler

Bun-based validator for the explicit centralized `.als/` metadata model.

The system registry owns a single `system_id`, declares top-level roots, and each module resolves from `root + dir`.

Shape files are inferred by convention as `.als/modules/<module-id>/v<version>.yaml`.

## Usage

```bash
cd v1/alsc/compiler
bun run src/index.ts ../../example-systems/centralized-metadata-happy-path
```

Optional module filter:

```bash
bun run src/index.ts ../../example-systems/centralized-metadata-happy-path backlog
```
