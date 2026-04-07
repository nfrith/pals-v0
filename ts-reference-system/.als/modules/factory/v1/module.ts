import { developmentPipeline } from "./delamains/development-pipeline/delamain.ts";

const required = <T extends Record<string, unknown>>(definition: T) =>
  ({
    ...definition,
    allowNull: false,
  }) as const;

const optional = <T extends Record<string, unknown>>(definition: T) =>
  ({
    ...definition,
    allowNull: true,
  }) as const;

const section = <T extends Record<string, unknown>>(name: string, definition: T) =>
  ({
    name,
    ...definition,
  }) as const;

const basicTextBlocks = {
  paragraph: {},
  bulletList: {},
  orderedList: {},
} as const;

const headedTextBlocks = {
  ...basicTextBlocks,
  heading: {
    minDepth: 3,
    maxDepth: 4,
  },
} as const;

const codeReviewBlocks = {
  ...headedTextBlocks,
  code: {
    requireLanguage: true,
  },
} as const;

const workItem = {
  entityId: "work-item",
  sourceFormat: "markdown",
  path: "items/{id}.md",

  identity: {
    idField: "id",
  },

  fields: {
    id: required({ type: "id" }),
    title: required({ type: "string" }),
    kind: required({
      type: "enum",
      values: ["bug", "feature", "hotfix", "experiment"],
    }),
    status: required({
      type: "delamain",
      delamain: developmentPipeline,
    }),
    priority: required({
      type: "enum",
      values: ["critical", "high", "medium", "low"],
    }),
    repository: required({ type: "string" }),
    created: required({ type: "date" }),
    updated: required({ type: "date" }),
    branch: optional({ type: "string" }),
    pr: optional({ type: "string" }),
  },

  body: {
    title: ({ id, title }: { id: string; title: string }) => `${id}: ${title}`,

    sections: [
      section("DESCRIPTION", {
        allowNull: false,
        content: {
          mode: "freeform",
          blocks: basicTextBlocks,
        },
        guidance: {
          include: "what this work item is, why it exists, and the user or operator impact",
          exclude: "timestamped execution history and review notes",
        },
      }),

      section("CURRENT_STATE", {
        allowNull: true,
        content: {
          mode: "freeform",
          blocks: basicTextBlocks,
        },
        guidance: {
          include: "the current technical or operational baseline before the change lands",
          exclude: "the proposed implementation plan",
        },
      }),

      section("REQUIREMENTS", {
        allowNull: true,
        content: {
          mode: "freeform",
          blocks: basicTextBlocks,
        },
        guidance: {
          include: "constraints, acceptance criteria, and non-negotiable requirements",
          exclude: "dated review outcomes",
        },
      }),

      section("DOD", {
        allowNull: true,
        content: {
          mode: "freeform",
          blocks: {
            bulletList: {},
            orderedList: {},
          },
        },
        guidance: {
          include: "concrete definition-of-done checks",
          exclude: "architecture rationale",
        },
      }),

      section("PLAN", {
        allowNull: true,
        content: {
          mode: "freeform",
          blocks: codeReviewBlocks,
        },
        guidance: {
          include: "the chosen implementation approach and execution steps",
          exclude: "operator Q and A that belongs in PLAN_QUESTIONS",
        },
      }),

      section("PLAN_QUESTIONS", {
        allowNull: true,
        content: {
          mode: "freeform",
          blocks: {
            ...headedTextBlocks,
            blockquote: {},
          },
        },
        guidance: {
          include: "planning questions, operator answers, and decision clarifications",
          exclude: "the implementation plan itself",
        },
      }),

      section("REVIEW", {
        allowNull: true,
        content: {
          mode: "freeform",
          blocks: codeReviewBlocks,
        },
        guidance: {
          include: "dated review findings, pass or fail reasoning, and required fixes",
          exclude: "UAT outcomes",
        },
      }),

      section("UAT", {
        allowNull: true,
        content: {
          mode: "freeform",
          blocks: headedTextBlocks,
        },
        guidance: {
          include: "dated operator testing results and acceptance or rejection notes",
          exclude: "code-review findings",
        },
      }),

      section("DEPLOYMENT", {
        allowNull: true,
        content: {
          mode: "freeform",
          blocks: codeReviewBlocks,
        },
        guidance: {
          include: "environment, rollout notes, verification checks, and failure context",
          exclude: "planning history",
        },
      }),

      section("ACTIVITY_LOG", {
        allowNull: false,
        content: {
          mode: "freeform",
          blocks: {
            bulletList: {},
            orderedList: {},
          },
        },
        guidance: {
          include: "dated append-only state changes, actions, and handoff notes",
          exclude: "evergreen requirements and architecture rationale",
        },
      }),
    ],
  },
} as const;

// Exploratory sketch: this is the same factory surface expressed as a bundle-like
// TypeScript module instead of a loose shape YAML plus external skill/delamain paths.
export const factoryModule = {
  moduleId: "factory",
  version: 1,
  mountPath: "workspace/factory",

  skills: {
    "factory-operate": {
      entry: "skills/factory-operate/SKILL.md",
    },
  },

  delamains: {
    developmentPipeline: {
      definition: developmentPipeline,
      agentsPath: "delamains/development-pipeline/agents",
      subAgentsPath: "delamains/development-pipeline/sub-agents",
    },
  },

  entities: {
    workItem,
  },
} as const;

export default factoryModule;
