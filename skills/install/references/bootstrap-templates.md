# Bootstrap Templates

Use these templates for the `/install` skeleton. Only two files are authored here — `.als/authoring.ts` and `.als/system.ts` — plus the empty `.als/modules/` directory. Module bundles are NOT authored by `/install`; they arrive from `/install-reference` or `/new` in Phase 7.

## `.als/authoring.ts`

Replace `__ALS_AUTHORING_IMPORT__` with the absolute path `${CLAUDE_PLUGIN_ROOT}/alsc/compiler/src/authoring/index.ts`.

```ts
export { defineSystem, defineModule, defineDelamain } from "__ALS_AUTHORING_IMPORT__";
```

## `.als/system.ts`

Use quoted keys and values to match the current authored style. Replace `__ALS_SYSTEM_ID__` with the operator's chosen `system_id` from Phase 4.

```ts
import { defineSystem } from "./authoring.ts";

export const system = defineSystem({
  "als_version": 1,
  "system_id": "__ALS_SYSTEM_ID__",
  "modules": {}
} as const);

export default system;
```

The `modules: {}` block stays empty. Module entries are appended later by `/install-reference` (copying from a reference system) or `/new` (authoring from scratch).

## Bootstrap contract

- Always create `.als/` and `.als/modules/` (the latter as an empty directory) before writing any `.als/*.ts` file.
- `/install` never writes anything under `.als/modules/` — that is the downstream skill's job.
- `.als/CLAUDE.md` is deploy-generated and must not be written by hand.
- The absolute import path in `.als/authoring.ts` is acceptable for this exploratory first pass.
