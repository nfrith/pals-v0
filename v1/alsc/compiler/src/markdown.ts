import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmTable } from "micromark-extension-gfm-table";
import { codes, diag } from "./diagnostics.ts";
import type {
  BodyRegionShape,
  FreeformContentShape,
  OutlineContentShape,
  OutlineNodeShape,
  SectionShape,
} from "./schema.ts";
import type { CompilerDiagnostic } from "./types.ts";

interface MdastPosition {
  start?: { line?: number; column?: number; offset?: number };
  end?: { line?: number; column?: number; offset?: number };
}

interface MdastNode {
  type?: string;
  depth?: number;
  ordered?: boolean;
  lang?: string | null;
  value?: string;
  children?: MdastNode[];
  position?: MdastPosition;
}

const REFERENCE_STYLE_MARKDOWN_NODE_TYPES = ["definition", "linkReference", "imageReference"] as const;
const INTENTIONALLY_REJECTED_MARKDOWN_NODE_TYPES = [
  ...REFERENCE_STYLE_MARKDOWN_NODE_TYPES,
  "html",
  "thematicBreak",
] as const;

type ReferenceStyleMarkdownNodeType = (typeof REFERENCE_STYLE_MARKDOWN_NODE_TYPES)[number];

export interface ParsedBodySection {
  name: string;
  content: string;
}

export interface ParsedBodyMarkdownSurface {
  reference_style: {
    node_types: ReferenceStyleMarkdownNodeType[];
    line?: number;
    column?: number;
  } | null;
  flow_html: {
    line?: number;
    column?: number;
  } | null;
  inline_html: {
    line?: number;
    column?: number;
  } | null;
  thematic_break: {
    line?: number;
    column?: number;
  } | null;
}

export interface ParsedBody {
  titles: string[];
  title: string | null;
  content_before_title: string;
  preamble: string;
  ordered: ParsedBodySection[];
  by_name: Map<string, string>;
  duplicate_section_names: string[];
  markdown_surface: ParsedBodyMarkdownSurface;
}

export function parseBody(body: string): ParsedBody {
  const tree = parseMarkdownTree(body, "record body");
  const children = rootChildren(tree, "record body");
  const markdown_surface = summarizeUnsupportedMarkdown(tree);
  const h1s = children.filter((child) => child.type === "heading" && child.depth === 1);
  const title = h1s.length > 0 ? headingText(h1s[0]) : null;
  const content_before_title = h1s.length > 0
    ? sliceRange(body, 0, nodeStartOffset(h1s[0], "top-level h1 title"), "content before title")
    : "";

  const firstSection = children.find((child) => child.type === "heading" && child.depth === 2);
  const preambleStart = h1s.length > 0 ? nodeEndOffset(h1s[0], "top-level h1 title") : 0;
  const preambleEnd = firstSection ? nodeStartOffset(firstSection, "top-level h2 section heading") : body.length;
  const preamble = sliceRange(body, preambleStart, preambleEnd, "top-level preamble");

  const ordered: ParsedBodySection[] = [];
  const by_name = new Map<string, string>();
  const duplicate_section_names: string[] = [];
  const sections = children.filter((child) => child.type === "heading" && child.depth === 2);
  for (const [index, sectionHeading] of sections.entries()) {
    const nextSection = sections[index + 1];
    const name = headingText(sectionHeading);
    const content = sliceRange(
      body,
      nodeEndOffset(sectionHeading, `section heading '## ${name}'`),
      nextSection ? nodeStartOffset(nextSection, "next top-level h2 section heading") : body.length,
      `section '## ${name}'`,
    );
    ordered.push({ name, content });
    if (by_name.has(name)) {
      duplicate_section_names.push(name);
      continue;
    }
    by_name.set(name, content);
  }

  return {
    titles: h1s.map((heading) => headingText(heading)),
    title,
    content_before_title,
    preamble,
    ordered,
    by_name,
    duplicate_section_names,
    markdown_surface,
  };
}

export function validateRegionMarkdown(
  label: string,
  region: BodyRegionShape,
  content: string,
  file: string,
  module_id: string,
  entity: string,
  structural_heading_depth: number,
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const trimmed = content.trim();

  if (trimmed === "null") {
    if (!region.allow_null) {
      diagnostics.push(
        diag(codes.BODY_NULL_NOT_ALLOWED, "error", "record_body", file, `Region '${label}' is not nullable but contains null`, {
          module_id,
          entity,
          field: label,
          expected: "non-null content",
          actual: "null",
        }),
      );
    }
    return diagnostics;
  }

  if (trimmed.length === 0) {
    diagnostics.push(
      diag(codes.BODY_EMPTY_MARKER, "error", "record_body", file, `Region '${label}' is empty`, {
        module_id,
        entity,
        field: label,
        expected: region.allow_null ? "content or explicit null" : "content",
        actual: "empty",
      }),
    );
    return diagnostics;
  }

  try {
    diagnostics.push(
      ...validateContentContract(label, region.content, trimmed, file, module_id, entity, structural_heading_depth),
    );
  } catch (error) {
    if (error instanceof MarkdownProcessingError) {
      diagnostics.push(
        diag(codes.PARSE_MARKDOWN, "error", "parse", file, error.message, {
          module_id,
          entity,
          field: label,
          actual: trimmed,
        }),
      );
      return diagnostics;
    }

    throw error;
  }

  return dedupeDiagnostics(diagnostics);
}

export function validateBodyMarkdownSurface(
  surface: ParsedBodyMarkdownSurface,
  file: string,
  module_id: string,
  entity: string,
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];

  // `parseBody()` already walked the full AST; this helper only translates that
  // stable summary into author-facing diagnostics.
  if (surface.reference_style) {
    diagnostics.push(
      diag(
        codes.BODY_UNSUPPORTED_MARKDOWN,
        "error",
        "record_body",
        file,
        "Reference-style links and images are not supported in ALS v1 record bodies",
        {
          module_id,
          entity,
          field: "body",
          expected: "inline [text](url) or ![alt](url) syntax",
          actual: surface.reference_style.node_types,
          hint: "Rewrite reference-style links, images, and definitions using inline markdown syntax.",
          line: surface.reference_style.line,
          column: surface.reference_style.column,
        },
      ),
    );
  }

  if (surface.flow_html) {
    diagnostics.push(
      diag(
        codes.BODY_UNSUPPORTED_MARKDOWN,
        "error",
        "record_body",
        file,
        "HTML blocks are not allowed in ALS v1 record bodies",
        {
          module_id,
          entity,
          field: "body",
          expected: "supported ALS v1 markdown blocks",
          actual: "html",
          hint: "Rewrite the block using supported markdown instead of raw HTML.",
          line: surface.flow_html.line,
          column: surface.flow_html.column,
        },
      ),
    );
  }

  if (surface.inline_html) {
    diagnostics.push(
      diag(
        codes.BODY_UNSUPPORTED_MARKDOWN,
        "error",
        "record_body",
        file,
        "Inline HTML is not allowed in ALS v1 record bodies",
        {
          module_id,
          entity,
          field: "body",
          expected: "plain markdown phrasing content without raw HTML",
          actual: "html",
          hint: "Rewrite the phrasing content with plain text, emphasis, links, images, or inline code.",
          line: surface.inline_html.line,
          column: surface.inline_html.column,
        },
      ),
    );
  }

  if (surface.thematic_break) {
    diagnostics.push(
      diag(
        codes.BODY_UNSUPPORTED_MARKDOWN,
        "error",
        "record_body",
        file,
        "Thematic breaks are not supported in ALS v1 record bodies",
        {
          module_id,
          entity,
          field: "body",
          expected: "supported ALS v1 body blocks",
          actual: "thematicBreak",
          hint: "Use headings or other supported body blocks instead of '---', '***', or '___'.",
          line: surface.thematic_break.line,
          column: surface.thematic_break.column,
        },
      ),
    );
  }

  return dedupeDiagnostics(diagnostics);
}

export function validateSectionMarkdown(
  section: SectionShape,
  content: string,
  file: string,
  module_id: string,
  entity: string,
): CompilerDiagnostic[] {
  return validateRegionMarkdown(section.name, section, content, file, module_id, entity, 2);
}

function validateContentContract(
  label: string,
  contentShape: BodyRegionShape["content"],
  source: string,
  file: string,
  module_id: string,
  entity: string,
  structural_heading_depth: number,
): CompilerDiagnostic[] {
  switch (contentShape.mode) {
    case "freeform":
      return validateFreeformContent(label, contentShape, source, file, module_id, entity, structural_heading_depth);
    case "outline":
      return validateOutlineContent(label, contentShape, source, file, module_id, entity, structural_heading_depth);
  }

  const unsupportedMode: never = contentShape;
  throw new Error(`Unhandled content mode: ${JSON.stringify(unsupportedMode)}`);
}

function validateFreeformContent(
  label: string,
  contentShape: FreeformContentShape,
  source: string,
  file: string,
  module_id: string,
  entity: string,
  structural_heading_depth: number,
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const tree = parseMarkdownTree(source, `region '${label}'`);
  const children = rootChildren(tree, `region '${label}'`);
  const counts = {
    paragraph: 0,
    blockquote: 0,
  };

  for (const child of children) {
    if (child.type === "paragraph") {
      counts.paragraph += 1;
      if (!contentShape.blocks.paragraph) {
        diagnostics.push(blockViolation(label, file, module_id, entity, "paragraph", contentShape.blocks));
      }
      continue;
    }

    if (child.type === "list") {
      const blockName = child.ordered === true ? "ordered_list" : "bullet_list";
      const blockConfig = contentShape.blocks[blockName];
      if (!blockConfig) {
        diagnostics.push(blockViolation(label, file, module_id, entity, blockName, contentShape.blocks));
        continue;
      }

      const itemCount = child.children?.length ?? 0;
      if (blockConfig.min_items !== undefined && itemCount < blockConfig.min_items) {
        diagnostics.push(
          diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `List block in region '${label}' has too few items`, {
            module_id,
            entity,
            field: label,
            expected: { min_items: blockConfig.min_items },
            actual: { items: itemCount, block: blockName },
          }),
        );
      }
      if (blockConfig.max_items !== undefined && itemCount > blockConfig.max_items) {
        diagnostics.push(
          diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `List block in region '${label}' has too many items`, {
            module_id,
            entity,
            field: label,
            expected: { max_items: blockConfig.max_items },
            actual: { items: itemCount, block: blockName },
          }),
        );
      }
      continue;
    }

    if (child.type === "heading") {
      const blockConfig = contentShape.blocks.heading;
      if (!blockConfig) {
        diagnostics.push(blockViolation(label, file, module_id, entity, "heading", contentShape.blocks));
        continue;
      }

      const depth = child.depth ?? 0;
      if (depth <= structural_heading_depth) {
        diagnostics.push(
          diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `Heading depth ${depth} is structural and cannot appear as freeform content in region '${label}'`, {
            module_id,
            entity,
            field: label,
            expected: `heading depth > ${structural_heading_depth}`,
            actual: depth,
          }),
        );
      }
      if (blockConfig.min_depth !== undefined && depth < blockConfig.min_depth) {
        diagnostics.push(
          diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `Heading depth ${depth} is too shallow for region '${label}'`, {
            module_id,
            entity,
            field: label,
            expected: { min_depth: blockConfig.min_depth },
            actual: depth,
          }),
        );
      }
      if (blockConfig.max_depth !== undefined && depth > blockConfig.max_depth) {
        diagnostics.push(
          diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `Heading depth ${depth} is too deep for region '${label}'`, {
            module_id,
            entity,
            field: label,
            expected: { max_depth: blockConfig.max_depth },
            actual: depth,
          }),
        );
      }
      continue;
    }

    if (child.type === "table") {
      if (!contentShape.blocks.table) {
        diagnostics.push(blockViolation(label, file, module_id, entity, "table", contentShape.blocks));
      }
      continue;
    }

    if (child.type === "blockquote") {
      counts.blockquote += 1;
      if (!contentShape.blocks.blockquote) {
        diagnostics.push(blockViolation(label, file, module_id, entity, "blockquote", contentShape.blocks));
      }
      continue;
    }

    if (child.type === "code") {
      const blockConfig = contentShape.blocks.code;
      if (!blockConfig) {
        diagnostics.push(blockViolation(label, file, module_id, entity, "code", contentShape.blocks));
        continue;
      }

      if (blockConfig.require_language && (!child.lang || child.lang.trim().length === 0)) {
        diagnostics.push(
          diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `Code blocks in region '${label}' must declare a language`, {
            module_id,
            entity,
            field: label,
            expected: { require_language: true },
            actual: child.lang ?? null,
          }),
        );
      }
      continue;
    }

    // The whole-body markdown-surface scan owns diagnostics for intentionally
    // rejected syntax, so region-level block validation must not also emit a
    // generic unsupported-block error for the same node.
    if (isIntentionallyRejectedTopLevelMarkdown(child)) {
      continue;
    }

    diagnostics.push(blockViolation(label, file, module_id, entity, String(child.type), contentShape.blocks));
  }

  validateCountConstraint(label, file, module_id, entity, "paragraph", counts.paragraph, contentShape.blocks.paragraph, diagnostics);
  validateCountConstraint(label, file, module_id, entity, "blockquote", counts.blockquote, contentShape.blocks.blockquote, diagnostics);

  return dedupeDiagnostics(diagnostics);
}

function validateOutlineContent(
  label: string,
  contentShape: OutlineContentShape,
  source: string,
  file: string,
  module_id: string,
  entity: string,
  structural_heading_depth: number,
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const tree = parseMarkdownTree(source, `region '${label}'`);
  const children = rootChildren(tree, `region '${label}'`);
  const matchedIndices: number[] = [];
  let searchFrom = 0;

  for (const expectedNode of contentShape.nodes) {
    const matchIndex = findOutlineNodeIndex(children, searchFrom, expectedNode);
    if (matchIndex === -1) {
      diagnostics.push(
        diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `Missing required outline node '${expectedNode.heading.text}' in region '${label}'`, {
          module_id,
          entity,
          field: label,
          expected: contentShape.nodes.map((node) => node.heading),
          actual: children
            .filter((child) => child.type === "heading")
            .map((child) => ({ depth: child.depth ?? null, text: headingText(child) })),
        }),
      );
      return diagnostics;
    }

    if (expectedNode.heading.depth <= structural_heading_depth) {
      diagnostics.push(
        diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `Outline node '${expectedNode.heading.text}' uses structural heading depth ${expectedNode.heading.depth} that is too shallow for region '${label}'`, {
          module_id,
          entity,
          field: label,
          expected: `heading depth > ${structural_heading_depth}`,
          actual: expectedNode.heading.depth,
        }),
      );
    }

    matchedIndices.push(matchIndex);
    searchFrom = matchIndex + 1;
  }

  const firstMatchedIndex = matchedIndices[0];
  const preamble = firstMatchedIndex === undefined
    ? source.trim()
    : sliceRange(source, 0, nodeStartOffset(children[firstMatchedIndex], `outline node '${contentShape.nodes[0].heading.text}'`), `${label}.preamble`);

  if (contentShape.preamble) {
    diagnostics.push(
      ...validateRegionMarkdown(`${label}.preamble`, contentShape.preamble, preamble, file, module_id, entity, structural_heading_depth),
    );
  } else if (preamble.trim().length > 0) {
    diagnostics.push(
      diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `Region '${label}' contains undeclared outline preamble content`, {
        module_id,
        entity,
        field: label,
        expected: "no preamble content",
        actual: preamble.trim(),
      }),
    );
  }

  for (const [index, matchedIndex] of matchedIndices.entries()) {
    const headingNode = children[matchedIndex];
    const nextMatchIndex = matchedIndices[index + 1];
    const expectedNode = contentShape.nodes[index];
    const nodeContent = sliceRange(
      source,
      nodeEndOffset(headingNode, `outline node '${expectedNode.heading.text}'`),
      nextMatchIndex !== undefined ? nodeStartOffset(children[nextMatchIndex], "next outline node heading") : source.length,
      `${label}.${expectedNode.heading.text}`,
    );

    const syntheticRegion: BodyRegionShape = {
      allow_null: false,
      content: expectedNode.content,
    };

    diagnostics.push(
      ...validateRegionMarkdown(`${label}.${expectedNode.heading.text}`, syntheticRegion, nodeContent, file, module_id, entity, expectedNode.heading.depth),
    );
  }

  return dedupeDiagnostics(diagnostics);
}

function validateCountConstraint(
  label: string,
  file: string,
  module_id: string,
  entity: string,
  blockName: "paragraph" | "blockquote",
  actualCount: number,
  constraint: { min_count?: number; max_count?: number } | undefined,
  diagnostics: CompilerDiagnostic[],
): void {
  if (!constraint) return;

  if (constraint.min_count !== undefined && actualCount < constraint.min_count) {
    diagnostics.push(
      diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `Region '${label}' has too few '${blockName}' blocks`, {
        module_id,
        entity,
        field: label,
        expected: { min_count: constraint.min_count, block: blockName },
        actual: actualCount,
      }),
    );
  }

  if (constraint.max_count !== undefined && actualCount > constraint.max_count) {
    diagnostics.push(
      diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `Region '${label}' has too many '${blockName}' blocks`, {
        module_id,
        entity,
        field: label,
        expected: { max_count: constraint.max_count, block: blockName },
        actual: actualCount,
      }),
    );
  }
}

function blockViolation(
  label: string,
  file: string,
  module_id: string,
  entity: string,
  actualBlock: string,
  expectedBlocks: FreeformContentShape["blocks"],
): CompilerDiagnostic {
  return diag(codes.BODY_CONSTRAINT_VIOLATION, "error", "record_body", file, `Region '${label}' contains unsupported markdown block '${actualBlock}'`, {
    module_id,
    entity,
    field: label,
    expected: Object.keys(expectedBlocks),
    actual: actualBlock,
  });
}

function summarizeUnsupportedMarkdown(root: MdastNode): ParsedBodyMarkdownSurface {
  const referenceStyleNodeTypes = new Set<ReferenceStyleMarkdownNodeType>();
  let referenceStyleNode: MdastNode | null = null;
  let flowHtmlNode: MdastNode | null = null;
  let inlineHtmlNode: MdastNode | null = null;
  let thematicBreakNode: MdastNode | null = null;

  visitMarkdownTree(root, undefined, (node, parent) => {
    if (isReferenceStyleMarkdownNode(node)) {
      referenceStyleNode ??= node;
      referenceStyleNodeTypes.add(node.type);
      return;
    }

    if (node.type === "html") {
      if (parent?.type === "root") {
        flowHtmlNode ??= node;
      } else {
        inlineHtmlNode ??= node;
      }
      return;
    }

    if (node.type === "thematicBreak") {
      thematicBreakNode ??= node;
    }
  });

  return {
    reference_style: referenceStyleNode
      ? {
        node_types: Array.from(referenceStyleNodeTypes).sort(),
        line: nodeLine(referenceStyleNode),
        column: nodeColumn(referenceStyleNode),
      }
      : null,
    flow_html: flowHtmlNode
      ? {
        line: nodeLine(flowHtmlNode),
        column: nodeColumn(flowHtmlNode),
      }
      : null,
    inline_html: inlineHtmlNode
      ? {
        line: nodeLine(inlineHtmlNode),
        column: nodeColumn(inlineHtmlNode),
      }
      : null,
    thematic_break: thematicBreakNode
      ? {
        line: nodeLine(thematicBreakNode),
        column: nodeColumn(thematicBreakNode),
      }
      : null,
  };
}

function visitMarkdownTree(
  node: MdastNode,
  parent: MdastNode | undefined,
  visit: (node: MdastNode, parent: MdastNode | undefined) => void,
): void {
  visit(node, parent);

  for (const child of node.children ?? []) {
    visitMarkdownTree(child, node, visit);
  }
}

function isIntentionallyRejectedTopLevelMarkdown(node: MdastNode): boolean {
  return node.type !== undefined && INTENTIONALLY_REJECTED_MARKDOWN_NODE_TYPES.includes(node.type as typeof INTENTIONALLY_REJECTED_MARKDOWN_NODE_TYPES[number]);
}

function isReferenceStyleMarkdownNode(node: MdastNode): node is MdastNode & { type: ReferenceStyleMarkdownNodeType } {
  return node.type !== undefined && REFERENCE_STYLE_MARKDOWN_NODE_TYPES.includes(node.type as ReferenceStyleMarkdownNodeType);
}

function findOutlineNodeIndex(children: MdastNode[], startIndex: number, expectedNode: OutlineNodeShape): number {
  for (let index = startIndex; index < children.length; index += 1) {
    const child = children[index];
    if (child.type !== "heading") continue;
    if ((child.depth ?? 0) !== expectedNode.heading.depth) continue;
    if (headingText(child) !== expectedNode.heading.text) continue;
    return index;
  }

  return -1;
}

function headingText(node: MdastNode): string {
  const parts: string[] = [];
  collectNodeText(node, parts);
  return parts.join("").trim();
}

function collectNodeText(node: MdastNode, parts: string[]): void {
  if (typeof node.value === "string") {
    parts.push(node.value);
  }

  for (const child of node.children ?? []) {
    collectNodeText(child, parts);
  }
}

export class MarkdownProcessingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MarkdownProcessingError";
  }
}

function parseMarkdownTree(source: string, label: string): MdastNode {
  try {
    return fromMarkdown(source, {
      extensions: [gfmTable()],
      mdastExtensions: [gfmTableFromMarkdown()],
    }) as MdastNode;
  } catch (error) {
    throw new MarkdownProcessingError(
      `Failed to parse markdown for ${label}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function rootChildren(tree: MdastNode, label: string): MdastNode[] {
  if (!Array.isArray(tree.children)) {
    throw new MarkdownProcessingError(`Markdown root for ${label} is missing child nodes`);
  }

  return tree.children;
}

function nodeStartOffset(node: MdastNode, label: string): number {
  const offset = node.position?.start?.offset;
  if (offset === undefined) {
    throw new MarkdownProcessingError(`Markdown node '${label}' is missing a start offset`);
  }

  return offset;
}

function nodeEndOffset(node: MdastNode, label: string): number {
  const offset = node.position?.end?.offset;
  if (offset === undefined) {
    throw new MarkdownProcessingError(`Markdown node '${label}' is missing an end offset`);
  }

  return offset;
}

function nodeLine(node: MdastNode): number | undefined {
  return node.position?.start?.line;
}

function nodeColumn(node: MdastNode): number | undefined {
  return node.position?.start?.column;
}

function sliceRange(source: string, startOffset: number, endOffset: number, label: string): string {
  if (startOffset < 0 || endOffset < 0 || startOffset > endOffset || endOffset > source.length) {
    throw new MarkdownProcessingError(
      `Markdown slice for ${label} is out of bounds (start=${startOffset}, end=${endOffset}, length=${source.length})`,
    );
  }

  return source.slice(startOffset, endOffset).trim();
}

function dedupeDiagnostics(diagnostics: CompilerDiagnostic[]): CompilerDiagnostic[] {
  const seen = new Set<string>();
  const deduped: CompilerDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.code}:${diagnostic.file}:${diagnostic.field}:${diagnostic.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(diagnostic);
  }

  return deduped;
}
