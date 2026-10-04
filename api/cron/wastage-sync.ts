import { cronAuthorized } from "../../src/server/jobs/auth.js";
import { scheduledWastageSync } from "../../src/server/wastage/service.js";
import type { ApiRequest, ApiResponse } from "../../src/server/compliance/http.js";

export function safeWastageError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Wastage sync failed";
  return raw
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(authorization|private[_ -]?key|password|secret|token)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 300);
}

export function wastageErrorCategory(error: unknown) {
  const message = safeWastageError(error).toLowerCase();
  if (message.includes("configuration is missing")) return "configuration";
  if (message.includes("oidc token exchange failed")) return "oidc_token_exchange_failed";
  if (message.includes("workload identity authentication")) return "google_auth";
  if (message.includes("permission denied")) return "google_permission_denied";
  if (message.includes("unexpected wastage headers")) return "sheet_headers";
  if (message.includes("duplicate wastage")) return "sheet_duplicates";
  if (message.includes("timed out") || message.includes("timeout")) return "timeout";
  if (message.includes("unauthorized") || message.includes("forbidden")) return "upstream_authorization";
  return "sync_failure";
}

export default async (req: ApiRequest, res: ApiResponse) => {
  if (!cronAuthorized(req.headers)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const startedAt = Date.now();
  try {
    const result = await scheduledWastageSync();
    if ("rowCount" in result) {
      console.info("wastage-sync", {
        job: "wastage-google-sheets",
        durationMs: Date.now() - startedAt,
        ok: true,
        rowCount: result.rowCount,
        updated: result.updated,
        appended: result.appended,
        unchanged: result.unchanged,
      });
    } else {
      console.info("wastage-sync", {
        job: "wastage-google-sheets",
        durationMs: Date.now() - startedAt,
        ok: true,
        skipped: result.skipped,
        reason: result.reason,
      });
    }
    res.status(200).json(result);
  } catch (error) {
    console.error("wastage-sync", {
      job: "wastage-google-sheets",
      durationMs: Date.now() - startedAt,
      ok: false,
      errorCategory: wastageErrorCategory(error),
      serviceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim() || "unknown",
      message: safeWastageError(error),
    });
    res.status(502).json({ ok: false, error: "Wastage sync failed" });
  }
};
