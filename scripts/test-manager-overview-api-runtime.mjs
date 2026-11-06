import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(join(root, "node_modules", ".tmp", "manager-overview-api-runtime-"));
const configPath = join(root, "tsconfig.app.json");

try {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined, "application TypeScript config should load");
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, {
    noEmit: false,
    noEmitOnError: true,
    outDir: join(tempRoot, "out"),
    rootDir: root,
    incremental: false,
    composite: false,
    allowImportingTsExtensions: false,
  }, configPath);
  const entry = join(root, "api", "manager-overview", "stores.ts");
  const program = ts.createProgram([entry], parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: file => file,
      getNewLine: () => "\n",
    }));
  }
  const emitted = program.emit();
  assert.equal(emitted.emitSkipped, false, "API module graph should emit for native Node ESM");

  const handlerUrl = pathToFileURL(join(tempRoot, "out", "api", "manager-overview", "stores.js")).href;
  const { default: handler } = await import(handlerUrl);
  assert.equal(typeof handler, "function", "actual serverless API entrypoint should load in Node ESM");

  let status = 0;
  let body;
  await handler({ method: "GET", headers: {} }, {
    status(code) { status = code; return this; },
    json(value) { body = value; },
  });
  assert.equal(status, 401, "real API handler should reject a request without a session");
  assert.equal(body?.ok, false);
  console.log("PASS: emitted manager-overview serverless API graph loads in native Node ESM and enforces unauthenticated 401");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
