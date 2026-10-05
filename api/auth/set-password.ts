import { getAuthContext, safeUser, setPassword, authenticateSession, SESSION_TTL_MS } from "../../src/server/auth/core.js";
import { assertMutationOrigin, readSessionCookie, sessionCookie } from "../../src/server/auth/cookies.js";
import { createDrizzleAuthRepository } from "../../src/server/auth/drizzle-repository.js";

type Request = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };
type Response = { setHeader: (name: string, value: string) => void; status: (code: number) => Response; json: (body: unknown) => void };
const bodyOf = (body: unknown) => typeof body === "string" ? JSON.parse(body) as { password?: string } : body as { password?: string };

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    assertMutationOrigin(req);
    const body = bodyOf(req.body);
    if (typeof body?.password !== "string") {
      res.status(400).json({ ok: false, error: "Password is required" });
      return;
    }
    const token = readSessionCookie(req.headers?.cookie);
    if (!token) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const repository = createDrizzleAuthRepository();
    const user = await authenticateSession(repository, token);
    if (!user) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const result = await setPassword(repository, user.id, body.password);
    if (!result) {
      res.status(401).json({ ok: false, error: "Authentication required" });
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
    if (error instanceof Error && error.message === "Invalid request origin") {
      res.status(403).json({ ok: false, error: error.message });
      return;
    }
    if (error instanceof Error && error.message.startsWith("Password must be")) {
      res.status(400).json({ ok: false, error: error.message });
      return;
    }
    console.error("Password setup failed", { category: "internal_error" });
    res.status(500).json({ ok: false, error: "Unable to set password" });
  }
}
