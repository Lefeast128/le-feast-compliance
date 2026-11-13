// Le Feast Hub sign-in. The hub (lefeast-hub) signs a short-lived pass
// { v, app, store, role, iat, exp } with HMAC-SHA256 using HUB_SSO_SECRET,
// which is shared between the hub and this app.
import { createHmac, timingSafeEqual } from "node:crypto";

export type HubPass = { ok: true; store: string; role: "manager" | "staff" } | { ok: false; error: string };

const MAX_LIFETIME_SECONDS = 300;

const fromB64url = (value: string) => Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function verifyHubPass(
  token: unknown,
  expectedApp: string,
  { secret = process.env.HUB_SSO_SECRET, now = Date.now() }: { secret?: string; now?: number } = {},
): HubPass {
  if (!secret || secret.length < 32) return { ok: false, error: "Hub sign-in is not configured" };
  if (typeof token !== "string" || token.split(".").length !== 2) return { ok: false, error: "Invalid pass" };
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = fromB64url(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, error: "Invalid pass" };
  let claims: Record<string, unknown>;
  try { claims = JSON.parse(fromB64url(body).toString("utf8")); } catch { return { ok: false, error: "Invalid pass" }; }
  const nowSeconds = Math.floor(now / 1000);
  const { v, app, store, role, iat, exp } = claims;
  if (v !== 1 || app !== expectedApp) return { ok: false, error: "Invalid pass" };
  if (typeof iat !== "number" || typeof exp !== "number") return { ok: false, error: "Invalid pass" };
  if (exp < nowSeconds || exp - iat > MAX_LIFETIME_SECONDS) return { ok: false, error: "Pass expired" };
  if (typeof store !== "string" || (role !== "manager" && role !== "staff")) return { ok: false, error: "Invalid pass" };
  return { ok: true, store, role };
}

// Which compliance user each hub login becomes. Kept out of the code (this
// repository is public): HUB_EHO_ACCOUNTS is JSON such as
// {"bolton:manager":"manager@example.com","bolton:staff":"staff@example.com"}.
export function hubAccountEmail(pass: HubPass, accountsJson = process.env.HUB_EHO_ACCOUNTS): string | null {
  if (!pass.ok || !accountsJson) return null;
  try {
    const accounts = JSON.parse(accountsJson) as Record<string, unknown>;
    const email = accounts[`${pass.store}:${pass.role}`];
    return typeof email === "string" && email.includes("@") ? email : null;
  } catch {
    return null;
  }
}
