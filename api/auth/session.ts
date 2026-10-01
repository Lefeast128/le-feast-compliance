import { getAuthContext, safeUser, authenticateSession } from "../../src/server/auth/core.js";
import { readSessionCookie } from "../../src/server/auth/cookies.js";
import { createDrizzleAuthRepository } from "../../src/server/auth/drizzle-repository.js";

type Request = { method?: string; headers?: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void };

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    const token = readSessionCookie(req.headers?.cookie);
    if (!token) {
      res.status(200).json({ authenticated: false });
      return;
    }
    const repository = createDrizzleAuthRepository();
    const user = await authenticateSession(repository, token);
    if (!user) {
      res.status(200).json({ authenticated: false });
      return;
    }
    const context = await getAuthContext(repository, user);
    res.status(200).json({ authenticated: true, user: safeUser(user), memberships: context.memberships });
  } catch (error) {
    console.error("Session lookup failed", error instanceof Error ? error.message : "unknown error");
    res.status(200).json({ authenticated: false });
  }
}
