import { SESSION_TTL_MS, getAuthContext, normalizeEmail, safeUser, verifyOtp } from "../../src/server/auth/core.js";
import { assertMutationOrigin, sessionCookie } from "../../src/server/auth/cookies.js";
import { createDrizzleAuthRepository } from "../../src/server/auth/drizzle-repository.js";

type Request = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };
type Response = { setHeader: (name: string, value: string) => void; status: (code: number) => Response; json: (body: unknown) => void };
const bodyOf = (body: unknown) => typeof body === "string" ? JSON.parse(body) as { email?: string; code?: string; purpose?: "setup" | "reset" } : body as { email?: string; code?: string; purpose?: "setup" | "reset" };

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    assertMutationOrigin(req);
    const body = bodyOf(req.body);
    if (!body?.email || typeof body.email !== "string" || !body.code || typeof body.code !== "string") {
      res.status(400).json({ ok: false, error: "Email and code are required" });
      return;
    }
    const repository = createDrizzleAuthRepository();
    const normalizedEmail = normalizeEmail(body.email);
    const existing = await repository.findUserByEmail(normalizedEmail);
    if (existing?.hasPassword && body.purpose !== "reset") {
      res.status(401).json({ ok: false, error: "Invalid or expired verification code" });
      return;
    }
    const result = await verifyOtp(repository, { email: normalizedEmail, code: body.code });
    if (!result) {
      res.status(401).json({ ok: false, error: "Invalid or expired verification code" });
      return;
    }
    const context = await getAuthContext(repository, result.user);
    res.setHeader("Set-Cookie", sessionCookie(result.sessionToken, SESSION_TTL_MS / 1000));
    res.status(200).json({ ok: true, user: safeUser(result.user), memberships: context.memberships });
  } catch (error) {
    if (error instanceof SyntaxError) {
      res.status(400).json({ ok: false, error: "Invalid JSON" });
      return;
    }
    console.error("OTP verification failed", error instanceof Error ? error.message : "unknown error");
    res.status(500).json({ ok: false, error: "Unable to verify code" });
  }
}
