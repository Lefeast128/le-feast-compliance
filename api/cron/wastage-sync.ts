import { cronAuthorized } from "../../src/server/jobs/auth.js";
import { scheduledWastageSync } from "../../src/server/wastage/service.js";
import type { ApiRequest, ApiResponse } from "../../src/server/compliance/http.js";
export default async (req: ApiRequest, res: ApiResponse) => { if (!cronAuthorized(req.headers)) { res.status(401).json({ ok: false, error: "Unauthorized" }); return; } if (req.method !== "GET" && req.method !== "POST") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; } try { res.status(200).json(await scheduledWastageSync()); } catch { res.status(502).json({ ok: false, error: "Wastage sync failed" }); } };
