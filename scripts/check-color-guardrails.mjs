import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoots = ["apps/web/src", "packages/ui/src"];
const sourceExtensions = new Set([".css", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const allowedTokenFiles = new Set([
  "packages/ui/src/styles/foundation.css",
  "packages/ui/src/styles/merchant-presets.css",
  "packages/ui/src/styles/primitives.css",
  "packages/ui/src/styles/tailwind-theme.css",
  "packages/ui/src/styles/tokens.css",
]);

const rules = [
  {
    name: "raw hexadecimal color",
    pattern: /#[0-9a-f]{3,8}\b/gi,
  },
  {
    name: "raw color function",
    pattern: /\b(?:color|hsl|hsla|hwb|lab|lch|oklab|oklch|rgb|rgba)\s*\(/gi,
  },
  {
    name: "direct primitive color variable",
    pattern: /var\(\s*--primitive-color-[a-z0-9-]+\s*\)/gi,
  },
  {
    name: "arbitrary Tailwind color",
    pattern:
      /\b(?:bg|border|decoration|fill|from|outline|ring|stroke|text|to|via)-\[[^\]]*(?:#|--|var\(|(?:color|hsl|hwb|lab|lch|oklab|oklch|rgb)\(|(?:black|currentcolor|transparent|white)\b)[^\]]*\]/gi,
  },
  {
    name: "primitive Tailwind palette utility",
    pattern:
      /\b(?:bg|border|decoration|fill|from|outline|ring|stroke|text|to|via)-(?:black|white|(?:amber|blue|cyan|emerald|fuchsia|gray|green|indigo|lime|neutral|orange|pink|purple|red|rose|sky|slate|stone|teal|violet|yellow|zinc)-\d{2,3})\b/gi,
  },
];

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
    } else if (sourceExtensions.has(extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

export function findColorViolations(source) {
  const violations = [];

  for (const rule of rules) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);

    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      violations.push({ line, match: match[0], rule: rule.name });
    }
  }

  return violations;
}

export async function checkColorGuardrails() {
  const files = (
    await Promise.all(
      sourceRoots.map((sourceRoot) => collectSourceFiles(resolve(workspaceRoot, sourceRoot))),
    )
  ).flat();
  const violations = [];

  for (const filePath of files) {
    const relativePath = normalizePath(relative(workspaceRoot, filePath));

    if (allowedTokenFiles.has(relativePath)) {
      continue;
    }

    const source = await readFile(filePath, "utf8");

    for (const violation of findColorViolations(source)) {
      violations.push({ ...violation, file: relativePath });
    }
  }

  return { filesScanned: files.length - allowedTokenFiles.size, violations };
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";

if (entryPath === import.meta.url) {
  const result = await checkColorGuardrails();

  if (result.violations.length > 0) {
    console.error("Color guardrail violations:");

    for (const violation of result.violations) {
      console.error(`- ${violation.file}:${violation.line} [${violation.rule}] ${violation.match}`);
    }

    process.exitCode = 1;
  } else {
    console.info(`Color guardrails passed (${result.filesScanned} source files scanned).`);
  }
}
