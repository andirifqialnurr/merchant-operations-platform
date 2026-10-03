// Module boundary lint for apps/api/src (docs/foundation/backend.md section 3).
// Run by `pnpm lint`. Spec files are exempt: tests may reach into a unit.
import { readdirSync, readFileSync } from "node:fs";
import process from "node:process";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Folders whose children are units, each closed behind its own public.ts. */
const UNIT_GROUPS = ["core", "kernels", "modules"];
/** Folders that are one unit on their own. `catalog` becomes a kernel in M2-QA-02. */
const SINGLE_UNITS = ["catalog"];

/** Which areas each area may import from. Areas not listed may import anything. */
const ALLOWED_AREAS = {
  bootstrap: ["bootstrap", "core", "shared"],
  catalog: ["catalog", "core", "shared"],
  core: ["core", "shared"],
  kernels: ["core", "kernels", "shared"],
  modules: ["catalog", "core", "kernels", "modules", "shared"],
  shared: ["shared"],
};

/** Known exceptions, each with the task that removes it. */
const EXCEPTIONS = [
  // The order kernel prices lines from the sellable menu. Catalog becomes a
  // kernel with a port for this in M2-QA-02.
  { from: "kernels/order-intake", to: "catalog" },
];

const FRAMEWORK_PACKAGES = [/^@nestjs\//, /^@merchant\/database$/, /^@prisma\//, /^express$/];
const PERSISTENCE_PACKAGES = [/^@merchant\/database$/, /^@prisma\//];

const posix = (value) => value.split(sep).join("/");

function sourceFiles(directory, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(path, found);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")) found.push(path);
  }
  return found;
}

/** Where a file sits: its area, its unit (if any), and its layer inside the unit. */
export function locate(path) {
  const parts = posix(relative(SRC, path)).split("/");
  const area = parts.length > 1 ? parts[0] : "root";
  let unit;
  let inside = parts.slice(1);
  if (UNIT_GROUPS.includes(area) && parts.length > 2) {
    unit = `${area}/${parts[1]}`;
    inside = parts.slice(2);
  } else if (SINGLE_UNITS.includes(area)) {
    unit = area;
  }
  const layer = ["domain", "application", "adapters"].find((name) => inside[0] === name);
  return { area, inside: inside.join("/"), layer, unit };
}

const IMPORT =
  /(?:\bimport\s+(?:type\s+)?(?:[^"';]*?\s+from\s+)?|\bexport\s+(?:type\s+)?[^"';]*?\s+from\s+|\bimport\s*\(\s*)["']([^"']+)["']/g;

/** The rule a single import breaks, or undefined when it is allowed. */
export function violation(importer, specifier) {
  const from = locate(importer);

  if (!specifier.startsWith(".")) {
    if (from.layer === "domain" && FRAMEWORK_PACKAGES.some((item) => item.test(specifier))) {
      return "domain code must not import a framework or the database";
    }
    if (from.layer === "application" && PERSISTENCE_PACKAGES.some((item) => item.test(specifier))) {
      return "application code must not import the database; use a port";
    }
    return undefined;
  }

  const target = join(dirname(importer), specifier);
  const to = locate(target);

  if (from.unit && from.unit === to.unit) {
    if (from.layer === "domain" && (to.layer === "application" || to.layer === "adapters")) {
      return "domain code must not import application or adapter code";
    }
    if (from.layer === "application" && to.layer === "adapters") {
      return "application code must not import adapters; depend on a port";
    }
    return undefined;
  }

  const allowed = ALLOWED_AREAS[from.area];
  const excepted = EXCEPTIONS.some((item) => item.from === from.unit && item.to === to.unit);
  if (allowed && !excepted) {
    if (!allowed.includes(to.area)) return `${from.area} must not import from ${to.area}`;
    if (from.area === "kernels" && to.area === "kernels")
      return "a kernel must not import another kernel";
    if (from.area === "modules" && to.area === "modules") {
      return "a module must not import another module without a manifest dependency";
    }
  }
  if (to.unit && to.inside !== "public.js") {
    return `import ${to.unit} through its public.ts`;
  }
  return undefined;
}

export function checkBoundaries() {
  const problems = [];
  for (const path of sourceFiles(SRC)) {
    for (const match of readFileSync(path, "utf8").matchAll(IMPORT)) {
      const problem = violation(path, match[1]);
      if (problem) problems.push(`${posix(relative(SRC, path))} -> ${match[1]}: ${problem}`);
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = checkBoundaries();
  if (problems.length > 0) {
    process.stderr.write(
      `Module boundary violations:\n${problems.map((item) => `- ${item}`).join("\n")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write("Module boundaries: OK\n");
}
