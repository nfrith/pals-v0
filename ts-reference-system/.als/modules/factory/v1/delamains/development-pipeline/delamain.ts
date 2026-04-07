type Transition = {
  class: "advance" | "rework" | "exit";
  from: string | readonly string[];
  to: string;
};

const advance = (from: Transition["from"], to: string) =>
  ({
    class: "advance",
    from,
    to,
  }) as const;

const rework = (from: Transition["from"], to: string) =>
  ({
    class: "rework",
    from,
    to,
  }) as const;

const exitTo = (from: Transition["from"], to: string) =>
  ({
    class: "exit",
    from,
    to,
  }) as const;

const openExitStates = [
  "draft",
  "queued",
  "planning",
  "plan-input",
  "plan-ready",
  "ready",
  "in-dev",
  "in-review",
  "uat-test",
  "deployment-ready",
  "deployment-failure",
] as const;

// Exploratory sketch: this version keeps the state machine declarative, but TS lets
// the repeated transitions and reused state groups read more like code.
export const developmentPipeline = {
  phases: ["intake", "planning", "implementation", "deployment", "closed"],

  states: {
    draft: {
      initial: true,
      phase: "intake",
      actor: "operator",
    },

    queued: {
      phase: "intake",
      actor: "agent",
      resumable: false,
      agentPath: "agents/queued.md",
    },

    planning: {
      phase: "planning",
      actor: "agent",
      resumable: true,
      delegated: true,
      sessionField: "planner_session",
      agentPath: "agents/planning.md",
    },

    "plan-input": {
      phase: "planning",
      actor: "operator",
    },

    "plan-ready": {
      phase: "planning",
      actor: "operator",
    },

    ready: {
      phase: "implementation",
      actor: "agent",
      resumable: false,
      agentPath: "agents/ready.md",
    },

    "in-dev": {
      phase: "implementation",
      actor: "agent",
      resumable: true,
      sessionField: "dev_session",
      agentPath: "agents/in-dev.md",
      subAgentPath: "sub-agents/developer.md",
    },

    "in-review": {
      phase: "implementation",
      actor: "agent",
      resumable: false,
      agentPath: "agents/in-review.md",
    },

    "uat-test": {
      phase: "implementation",
      actor: "operator",
    },

    "deployment-ready": {
      phase: "deployment",
      actor: "agent",
      resumable: false,
      agentPath: "agents/deployment-ready.md",
    },

    deploying: {
      phase: "deployment",
      actor: "agent",
      resumable: false,
      agentPath: "agents/deploying.md",
    },

    "deployment-testing": {
      phase: "deployment",
      actor: "agent",
      resumable: false,
      agentPath: "agents/deployment-testing.md",
    },

    "deployment-failure": {
      phase: "deployment",
      actor: "operator",
    },

    completed: {
      phase: "closed",
      terminal: true,
    },

    deferred: {
      phase: "closed",
      terminal: true,
    },

    cancelled: {
      phase: "closed",
      terminal: true,
    },
  },

  transitions: [
    advance("draft", "queued"),
    advance("queued", "planning"),
    advance("planning", "plan-input"),
    advance("planning", "plan-ready"),
    rework("plan-input", "queued"),
    advance("plan-ready", "ready"),
    rework("plan-ready", "queued"),
    advance("ready", "in-dev"),
    advance("in-dev", "in-review"),
    rework("in-review", "ready"),
    advance("in-review", "uat-test"),
    advance("uat-test", "deployment-ready"),
    rework("uat-test", "queued"),
    advance("deployment-ready", "deploying"),
    advance("deploying", "deployment-testing"),
    exitTo("deployment-testing", "completed"),
    rework("deployment-testing", "deployment-failure"),
    rework("deployment-failure", "ready"),
    rework("deployment-failure", "queued"),
    exitTo(openExitStates, "deferred"),
    exitTo(openExitStates, "cancelled"),
  ],
} as const;

export default developmentPipeline;
