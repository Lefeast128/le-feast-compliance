import { authenticateSession, getAuthContext } from "../src/server/auth/core.js";
import { readSessionCookie } from "../src/server/auth/cookies.js";
import { createDrizzleAuthRepository } from "../src/server/auth/drizzle-repository.js";
import { listAccessibleLocations } from "../src/server/dashboard/repository.js";

type Request = { method?: string; headers?: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void };

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    const repository = createDrizzleAuthRepository();
    const token = readSessionCookie(req.headers?.cookie);
    const user = token ? await authenticateSession(repository, token) : null;
    if (!user) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const context = await getAuthContext(repository, user);
    res.status(200).json({ locations: await listAccessibleLocations(context) });
  } catch (error) {
    console.error("Location lookup failed", error instanceof Error ? error.message : "unknown error");
    res.status(500).json({ ok: false, error: "Unable to load locations" });
  }
}
