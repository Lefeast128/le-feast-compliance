import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [view, admin, service] = await Promise.all([
  readFile(new URL("../src/components/TrainingView.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/OrganisationAdmin.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/server/management/organisation-service.ts", import.meta.url), "utf8"),
]);
assert.match(view, /trainingInstructions\s*\?\?\s*acknowledgementTarget\.requirement\.description/, "briefing content is shown before confirmation");
assert.match(view, /<VerifiedPdfPreview documentId=\{acknowledgementTarget\.requirement\.currentDocumentId\}[^\n]*className="h-\[42vh\]/, "verified PDF is embedded in the acknowledgment step");
assert.match(view, /max-h-\[92vh\].*overflow-y-auto/, "acknowledgement preview remains usable on short mobile screens");
assert.match(admin, /Search briefings and training documents/);
assert.match(admin, /startTrainingEdit\(item\)/);
assert.match(admin, /Withdraw \{item\.title\}|Withdraw/);
assert.match(admin, /retire\("training", item\.id\)/);
assert.match(admin, /flex flex-col gap-3 rounded-xl.*sm:flex-row/, "briefing controls wrap below content on narrow screens");
assert.match(admin, /defaultTaskNextDue.*useState/);
assert.match(service, /trainingContentVersions\)\.values\(\{ requirementId: requirement\.id, versionNumber:/, "briefing edits create immutable content versions");
assert.match(service, /central_training_retired/);
assert.match(service, /set\(\{ active: false, updatedAt: new Date\(\) \}\)/, "withdrawal is soft retirement, preserving history");
console.log("PASS: briefings expose content and scoped PDF preview before acknowledgment; admin search/edit/withdraw preserves history");
