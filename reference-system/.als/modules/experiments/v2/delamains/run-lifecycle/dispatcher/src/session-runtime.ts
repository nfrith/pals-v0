const AGENT_SDK_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SessionDispatchEntry {
  delegated: boolean;
  resumable: boolean;
  sessionField?: string;
}

export interface SessionRuntimeNoResumeState {
  /**
   * True when the dispatcher should append `session_field` / `session_id`
   * to Runtime Context. Delegated states keep this true even when both
   * runtime values are null.
   */
  includeRuntimeKeys: boolean;
  runtimeSessionField: string | null;
  runtimeSessionId: string | null;
  resume: "no";
  resumeSessionId?: undefined;
  ignoredInvalidSessionId?: string;
}

export interface SessionRuntimeResumeState {
  includeRuntimeKeys: true;
  runtimeSessionField: string;
  runtimeSessionId: string;
  resume: "yes";
  resumeSessionId: string;
  ignoredInvalidSessionId?: undefined;
}

export type SessionRuntimeState =
  | SessionRuntimeNoResumeState
  | SessionRuntimeResumeState;

export function buildSessionRuntimeState(
  entry: SessionDispatchEntry,
  storedSessionId: string | null,
): SessionRuntimeState {
  if (entry.delegated) {
    return {
      includeRuntimeKeys: true,
      runtimeSessionField: entry.sessionField ?? null,
      runtimeSessionId: storedSessionId,
      resume: "no",
    };
  }

  if (!entry.sessionField) {
    return {
      includeRuntimeKeys: false,
      runtimeSessionField: null,
      runtimeSessionId: null,
      resume: "no",
    };
  }

  if (!storedSessionId) {
    return {
      includeRuntimeKeys: true,
      runtimeSessionField: entry.sessionField,
      runtimeSessionId: null,
      resume: "no",
    };
  }

  if (!AGENT_SDK_SESSION_ID_PATTERN.test(storedSessionId)) {
    return {
      includeRuntimeKeys: true,
      runtimeSessionField: entry.sessionField,
      runtimeSessionId: null,
      resume: "no",
      ignoredInvalidSessionId: storedSessionId,
    };
  }

  return {
    includeRuntimeKeys: true,
    runtimeSessionField: entry.sessionField,
    runtimeSessionId: storedSessionId,
    resume: "yes",
    resumeSessionId: storedSessionId,
  };
}

export function shouldPersistDispatcherSession(
  entry: SessionDispatchEntry,
  sessionId: string | undefined,
  sessionState: SessionRuntimeState,
): boolean {
  return Boolean(
    !entry.delegated
    && entry.resumable
    && entry.sessionField
    && sessionId
    && sessionState.resume === "no",
  );
}
