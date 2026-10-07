import assert from "node:assert/strict";
import { createServer } from "node:http";
import { put } from "@vercel/blob/client";

const sizes = [4, 8, 11.6, 20].map((megabytes) => Math.round(megabytes * 1024 * 1024));
const requests = [];

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const server = createServer(async (request, response) => {
  const body = await readBody(request);
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const action = request.headers["x-mpu-action"] ?? "single";
  requests.push({ method: request.method, action, pathname: url.searchParams.get("pathname"), bytes: body.length });
  response.setHeader("content-type", "application/json");
  if (action === "create") {
    response.end(JSON.stringify({ uploadId: `upload-${requests.length}`, key: `key-${requests.length}` }));
    return;
  }
  if (action === "upload") {
    response.end(JSON.stringify({ etag: `etag-${requests.length}` }));
    return;
  }
  if (action === "complete") {
    response.end(JSON.stringify({ url: "http://127.0.0.1/blob", downloadUrl: "http://127.0.0.1/blob", pathname: url.searchParams.get("pathname"), contentType: "application/pdf", contentDisposition: "inline", etag: `etag-${requests.length}` }));
    return;
  }
  response.end(JSON.stringify({ url: "http://127.0.0.1/blob", downloadUrl: "http://127.0.0.1/blob", pathname: url.searchParams.get("pathname"), contentType: "application/pdf", contentDisposition: "inline", etag: `etag-${requests.length}` }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
process.env.VERCEL_BLOB_API_URL = `http://127.0.0.1:${address.port}`;

try {
  for (const size of sizes) {
    const bytes = new Uint8Array(size);
    bytes.set(new TextEncoder().encode("%PDF-1.7"));
    const before = requests.length;
    const result = await put(`compliance/test/${size}.pdf`, new Blob([bytes], { type: "application/pdf" }), {
      access: "private",
      token: "vercel_blob_client_store_test",
      contentType: "application/pdf",
      multipart: size > 5 * 1024 * 1024,
    });
    assert.equal(result.contentType, "application/pdf");
    const uploadRequests = requests.slice(before);
    if (size <= 5 * 1024 * 1024) {
      assert.equal(uploadRequests.length, 1);
      assert.equal(uploadRequests[0].method, "PUT");
      assert.equal(uploadRequests[0].bytes, size);
    } else {
      assert.equal(uploadRequests[0].action, "create");
      assert.equal(uploadRequests.at(-1).action, "complete");
      const uploadedBytes = uploadRequests.filter((item) => item.action === "upload").reduce((sum, item) => sum + item.bytes, 0);
      assert.equal(uploadedBytes, size);
    }
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log("Large PDF transport tests passed: 4 MB, 8 MB, 11.6 MB, 20 MB");
