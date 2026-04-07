import { readdir, readFile } from "fs/promises";
import { join, relative } from "path";

interface PathSegment {
  kind: "literal" | "placeholder";
  text: string;
  entityName?: string;
}

interface ParsedPathTemplate {
  segments: PathSegment[];
}

export interface WorkItem {
  id: string;
  status: string;
  type: string;
  filePath: string;
}

function parseFrontmatter(raw: string): Record<string, string> {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return {};
  const fields: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "---") break;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  return fields;
}

function parsePathTemplate(template: string): ParsedPathTemplate {
  return {
    segments: template.split("/").map((part) => {
      const match = part.match(/^(.*)\{([^}]+)\}(.*)$/);
      if (!match) {
        return {
          kind: "literal" as const,
          text: part,
        };
      }

      return {
        kind: "placeholder" as const,
        text: part,
        entityName: match[2] === "id" ? "id" : match[2],
      };
    }),
  };
}

function matchesPathTemplate(concretePath: string, template: ParsedPathTemplate): boolean {
  const concreteParts = concretePath.split("/");
  if (concreteParts.length !== template.segments.length) return false;

  const bindings = new Map<string, string>();

  for (let index = 0; index < template.segments.length; index += 1) {
    const templateSegment = template.segments[index]!;
    const concretePart = concreteParts[index]!;

    if (templateSegment.kind === "literal") {
      if (templateSegment.text !== concretePart) return false;
      continue;
    }

    const match = templateSegment.text.match(/^(.*)\{[^}]+\}(.*)$/);
    if (!match) return false;

    const prefix = match[1]!;
    const suffix = match[2]!;

    if (prefix && !concretePart.startsWith(prefix)) return false;
    if (suffix && !concretePart.endsWith(suffix)) return false;

    const captured = concretePart.slice(
      prefix.length,
      suffix ? concretePart.length - suffix.length : undefined,
    );
    if (captured.length === 0) return false;

    const bindingKey = templateSegment.entityName!;
    if (bindings.has(bindingKey) && bindings.get(bindingKey) !== captured) {
      return false;
    }
    bindings.set(bindingKey, captured);
  }

  return true;
}

async function collectMarkdownFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

export async function scan(
  moduleRoot: string,
  entityPath: string,
  statusField: string,
  discriminatorField?: string,
  discriminatorValue?: string,
): Promise<WorkItem[]> {
  const template = parsePathTemplate(entityPath);
  const candidates = await collectMarkdownFiles(moduleRoot);
  const items: WorkItem[] = [];

  for (const filePath of candidates) {
    const relativePath = relative(moduleRoot, filePath).replace(/\\/g, "/");
    if (!matchesPathTemplate(relativePath, template)) continue;

    try {
      const frontmatter = parseFrontmatter(await readFile(filePath, "utf-8"));
      if (!frontmatter["id"] || !frontmatter[statusField]) continue;

      if (discriminatorField && discriminatorValue) {
        if (frontmatter[discriminatorField] !== discriminatorValue) continue;
      }

      items.push({
        id: frontmatter["id"]!,
        status: frontmatter[statusField]!,
        type: frontmatter["type"] ?? "unknown",
        filePath,
      });
    } catch {
      // Skip unreadable files
    }
  }

  return items;
}
