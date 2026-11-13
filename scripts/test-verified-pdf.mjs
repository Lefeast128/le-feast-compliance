import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readVerifiedPdf } from "../src/lib/verified-pdf.ts";

const pdf = new TextEncoder().encode("%PDF-1.7\nfictional test document");
const response = (body, headers = {}, status = 200) => new Response(body, { status, headers });

const verified = await readVerifiedPdf(response(pdf, { "Content-Type": "application/pdf", "X-Document-Id": "expected-document" }), "expected-document");
assert.equal(verified.type, "application/pdf");
assert.equal(await verified.text(), "%PDF-1.7\nfictional test document");

await assert.rejects(() => readVerifiedPdf(response(pdf, { "Content-Type": "application/pdf", "X-Document-Id": "other-document" }), "expected-document"), /could not be verified/);
await assert.rejects(() => readVerifiedPdf(response(pdf, { "Content-Type": "text/html", "X-Document-Id": "expected-document" }), "expected-document"), /not a PDF/);
await assert.rejects(() => readVerifiedPdf(response(new TextEncoder().encode("not a PDF"), { "Content-Type": "application/pdf", "X-Document-Id": "expected-document" }), "expected-document"), /file could not be verified/);
await assert.rejects(() => readVerifiedPdf(response(pdf, { "Content-Type": "application/pdf" }, 403), "expected-document"), /could not be verified/);

const service = await readFile(new URL("../src/server/training/service.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../api/documents/[id].ts", import.meta.url), "utf8");
assert.match(service, /currentDocument = current\?\.documentId \? documentById\.get\(current\.documentId\)/, "the preview source is the exact current training version's document row");
assert.match(service, /documentUrl: requirement\.trainingFormat === "document" && currentDocument \? `\/api\/documents\/\$\{currentDocument\.id\}/, "the browser URL uses that document row's ID");
assert.match(route, /documentForAccess\(context, String\(id \?\? ""\), typeof locationId === "string" \? locationId : undefined\)/, "the private document route authorizes and fetches the requested document ID");
assert.match(route, /readPrivateDocument\(document\)/, "storage resolution uses only the authorised database document row");

console.log("Verified PDF identity and unavailable-state checks passed (fictional PDF bytes; service/API binding assertions)." );
