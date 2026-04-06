import { expect, test } from "bun:test";
import {
  buildSessionRuntimeState,
  shouldPersistDispatcherSession,
} from "../../../skills/new/references/dispatcher/src/session-runtime.ts";

test("direct resumable dispatch resumes valid SDK session ids", () => {
  const state = buildSessionRuntimeState(
    {
      delegated: false,
      resumable: true,
      sessionField: "planner_session",
    },
    "8d4d2ecb-0c59-4c5c-946c-2d44ef7b43b8",
  );

  expect(state.includeRuntimeKeys).toBe(true);
  expect(state.runtimeSessionField).toBe("planner_session");
  expect(state.runtimeSessionId).toBe("8d4d2ecb-0c59-4c5c-946c-2d44ef7b43b8");
  expect(state.resume).toBe("yes");
  expect(state.resumeSessionId).toBe("8d4d2ecb-0c59-4c5c-946c-2d44ef7b43b8");
});

test("direct non-resumable dispatch omits runtime session keys", () => {
  const state = buildSessionRuntimeState(
    {
      delegated: false,
      resumable: false,
    },
    null,
  );

  expect(state.includeRuntimeKeys).toBe(false);
  expect(state.runtimeSessionField).toBeNull();
  expect(state.runtimeSessionId).toBeNull();
  expect(state.resume).toBe("no");
});

test("direct resumable first-run dispatch exposes session field without resume", () => {
  const state = buildSessionRuntimeState(
    {
      delegated: false,
      resumable: true,
      sessionField: "planner_session",
    },
    null,
  );

  expect(state.includeRuntimeKeys).toBe(true);
  expect(state.runtimeSessionField).toBe("planner_session");
  expect(state.runtimeSessionId).toBeNull();
  expect(state.resume).toBe("no");
  expect(state.resumeSessionId).toBeUndefined();
});

test("direct resumable dispatch ignores invalid stored SDK session ids", () => {
  const state = buildSessionRuntimeState(
    {
      delegated: false,
      resumable: true,
      sessionField: "planner_session",
    },
    "codex:ghost-tree:plan-SWF-001",
  );

  expect(state.includeRuntimeKeys).toBe(true);
  expect(state.runtimeSessionField).toBe("planner_session");
  expect(state.runtimeSessionId).toBeNull();
  expect(state.resume).toBe("no");
  expect(state.resumeSessionId).toBeUndefined();
  expect(state.ignoredInvalidSessionId).toBe("codex:ghost-tree:plan-SWF-001");
});

test("delegated dispatch exposes saved worker session ids without SDK resume", () => {
  const state = buildSessionRuntimeState(
    {
      delegated: true,
      resumable: true,
      sessionField: "planner_session",
    },
    "codex:ghost-tree:plan-SWF-001",
  );

  expect(state.includeRuntimeKeys).toBe(true);
  expect(state.runtimeSessionField).toBe("planner_session");
  expect(state.runtimeSessionId).toBe("codex:ghost-tree:plan-SWF-001");
  expect(state.resume).toBe("no");
  expect(state.resumeSessionId).toBeUndefined();
  expect(state.ignoredInvalidSessionId).toBeUndefined();
});

test("delegated dispatch keeps valid UUID worker session ids as runtime metadata only", () => {
  const state = buildSessionRuntimeState(
    {
      delegated: true,
      resumable: true,
      sessionField: "planner_session",
    },
    "8d4d2ecb-0c59-4c5c-946c-2d44ef7b43b8",
  );

  expect(state.includeRuntimeKeys).toBe(true);
  expect(state.runtimeSessionField).toBe("planner_session");
  expect(state.runtimeSessionId).toBe("8d4d2ecb-0c59-4c5c-946c-2d44ef7b43b8");
  expect(state.resume).toBe("no");
  expect(state.resumeSessionId).toBeUndefined();
});

test("delegated dispatch without a session field still emits null-shaped runtime keys", () => {
  const state = buildSessionRuntimeState(
    {
      delegated: true,
      resumable: false,
    },
    null,
  );

  expect(state.includeRuntimeKeys).toBe(true);
  expect(state.runtimeSessionField).toBeNull();
  expect(state.runtimeSessionId).toBeNull();
  expect(state.resume).toBe("no");
});

test("dispatcher session persistence is disabled for delegated states", () => {
  expect(
    shouldPersistDispatcherSession(
      {
        delegated: true,
        resumable: true,
        sessionField: "planner_session",
      },
      "8d4d2ecb-0c59-4c5c-946c-2d44ef7b43b8",
      buildSessionRuntimeState(
        {
          delegated: true,
          resumable: true,
          sessionField: "planner_session",
        },
        "8d4d2ecb-0c59-4c5c-946c-2d44ef7b43b8",
      ),
    ),
  ).toBe(false);

  expect(
    shouldPersistDispatcherSession(
      {
        delegated: false,
        resumable: true,
        sessionField: "dev_session",
      },
      "8d4d2ecb-0c59-4c5c-946c-2d44ef7b43b8",
      buildSessionRuntimeState(
        {
          delegated: false,
          resumable: true,
          sessionField: "dev_session",
        },
        null,
      ),
    ),
  ).toBe(true);
});

test("dispatcher session persistence is disabled for resumed direct sessions", () => {
  expect(
    shouldPersistDispatcherSession(
      {
        delegated: false,
        resumable: true,
        sessionField: "dev_session",
      },
      "11111111-1111-4111-8111-111111111111",
      buildSessionRuntimeState(
        {
          delegated: false,
          resumable: true,
          sessionField: "dev_session",
        },
        "8d4d2ecb-0c59-4c5c-946c-2d44ef7b43b8",
      ),
    ),
  ).toBe(false);
});

test("dispatcher session persistence is disabled when no new SDK session id is available", () => {
  expect(
    shouldPersistDispatcherSession(
      {
        delegated: false,
        resumable: true,
        sessionField: "dev_session",
      },
      undefined,
      buildSessionRuntimeState(
        {
          delegated: false,
          resumable: true,
          sessionField: "dev_session",
        },
        null,
      ),
    ),
  ).toBe(false);
});

test("dispatcher session persistence is disabled for non-resumable direct states", () => {
  expect(
    shouldPersistDispatcherSession(
      {
        delegated: false,
        resumable: false,
      },
      "8d4d2ecb-0c59-4c5c-946c-2d44ef7b43b8",
      buildSessionRuntimeState(
        {
          delegated: false,
          resumable: false,
        },
        null,
      ),
    ),
  ).toBe(false);
});
