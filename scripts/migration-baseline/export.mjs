import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { ALL_TABLES } from "./constants.mjs";
import { buildBaseline } from "./baseline.mjs";

function parseArgs(argv) {
  const args = { fixture: null, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--fixture") args.fixture = argv[++index];
    else if (value === "--out") args.out = argv[++index];
    else if (value === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function parseConvexJson(output) {
  const trimmed = output.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    for (
      let index = trimmed.indexOf("{");
      index >= 0;
      index = trimmed.indexOf("{", index + 1)
    ) {
      try {
        const parsed = JSON.parse(trimmed.slice(index));
        if (
          parsed &&
          Array.isArray(parsed.page) &&
          typeof parsed.table === "string"
        )
          return parsed;
      } catch {
        // Convex CLI diagnostics may precede the JSON result.
      }
    }
  }
  throw new Error("Convex CLI did not return a migration page");
}

function convexCliPath() {
  const local = resolve("node_modules/.bin/convex");
  return existsSync(local) ? local : "npx";
}

function readConvexPage(table, cursor) {
  const executable = convexCliPath();
  const commandArgs =
    executable === "npx"
      ? [
          "convex",
          "run",
          "migrationBaseline:page",
          JSON.stringify({ table, cursor, numItems: 250 }),
          "--prod",
          "--typecheck",
          "disable",
          "--codegen",
          "disable",
        ]
      : [
          "run",
          "migrationBaseline:page",
          JSON.stringify({ table, cursor, numItems: 250 }),
          "--prod",
          "--typecheck",
          "disable",
          "--codegen",
          "disable",
        ];
  const result = spawnSync(executable, commandArgs, {
    cwd: resolve("."),
    encoding: "utf8",
    env: { ...process.env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Convex read-only export failed for ${table}: ${result.stderr.trim() || "unknown CLI error"}`,
    );
  }
  return parseConvexJson(result.stdout);
}

function loadFixture(path) {
  const fixture = JSON.parse(readFileSync(resolve(path), "utf8"));
  if (!fixture || typeof fixture !== "object" || !fixture.tables) {
    throw new Error("Fixture must contain a tables object");
  }
  return {
    records: Object.fromEntries(
      ALL_TABLES.map((table) => [table, fixture.tables[table] ?? []]),
    ),
    storageReferences: fixture.storageReferences ?? [],
  };
}

function exportProduction() {
  const records = {};
  const storageReferences = [];
  for (const table of ALL_TABLES) {
    const tableRecords = [];
    let cursor;
    do {
      const result = readConvexPage(table, cursor);
      if (result.table !== table)
        throw new Error(`Convex returned the wrong table for ${table}`);
      tableRecords.push(...result.page);
      storageReferences.push(...(result.storageReferences ?? []));
      cursor = result.isDone ? undefined : result.continueCursor;
    } while (cursor);
    records[table] = tableRecords;
  }
  return { records, storageReferences };
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(
    "Usage: npm run migration:baseline -- [--fixture path] [--out path]",
  );
  process.exit(0);
}

const input = args.fixture ? loadFixture(args.fixture) : exportProduction();
const baseline = buildBaseline(input.records, input.storageReferences);
const serialized = `${JSON.stringify(baseline, null, 2)}\n`;

if (args.out) {
  writeFileSync(resolve(args.out), serialized, {
    encoding: "utf8",
    flag: "wx",
  });
} else {
  process.stdout.write(serialized);
}
