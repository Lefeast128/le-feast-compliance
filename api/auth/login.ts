import { loginWithPassword, PasswordLoginRateLimitError, getAuthContext, safeUser, SESSION_TTL_MS } from "../../src/server/auth/core.js";
import { assertMutationOrigin, sessionCookie } from "../../src/server/auth/cookies.js";
import { createDrizzleAuthRepository } from "../../src/server/auth/drizzle-repository.js";

type Request = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };
type Response = { setHeader: (name: string, value: string) => void; status: (code: number) => Response; json: (body: unknown) => void };

const bodyOf = (body: unknown) => typeof body === "string" ? JSON.parse(body) as { email?: string; password?: string } : body as { email?: string; password?: string };
const genericError = { ok: false, error: "Invalid email or password" };

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    assertMutationOrigin(req);
    const body = bodyOf(req.body);
    if (typeof body?.email !== "string" || typeof body?.password !== "string" || !body.email.trim() || !body.password) {
      res.status(401).json(genericError);
      return;
    }
    const forwardedFor = req.headers?.["x-forwarded-for"];
    const rateLimitKey = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]?.trim();
    const result = await loginWithPassword(createDrizzleAuthRepository(), { email: body.email, password: body.password, rateLimitKey });
    if (!result) {
      res.status(401).json(genericError);
      return;
    }
    const context = await getAuthContext(createDrizzleAuthRepository(), result.user);
    res.setHeader("Set-Cookie", sessionCookie(result.sessionToken, SESSION_TTL_MS / 1000));
    res.status(200).json({ ok: true, user: safeUser(result.user), memberships: context.memberships });
  } catch (error) {
    if (error instanceof SyntaxError) {
      res.status(401).json(genericError);
      return;
    }
    if (error instanceof Error && error.message === "Invalid request origin") {
      res.status(403).json({ ok: false, error: error.message });
      return;
    }
    if (error instanceof PasswordLoginRateLimitError) {
      res.status(429).json(genericError);
      return;
    }
    console.error("Password login failed", { category: "internal_error" });
    res.status(500).json({ ok: false, error: "Unable to sign in" });
  }
}
