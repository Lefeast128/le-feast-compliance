import { authenticateSession, getAuthContext } from "../src/server/auth/core.js";
import { readSessionCookie } from "../src/server/auth/cookies.js";
import { createDrizzleAuthRepository } from "../src/server/auth/drizzle-repository.js";
import { getDashboard } from "../src/server/dashboard/repository.js";

type Request = { method?: string; query?: Record<string, string | string[] | undefined>; headers?: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void };

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    const locationValue = req.query?.locationId;
    const locationId = Array.isArray(locationValue) ? locationValue[0] : locationValue;
    if (!locationId || !/^[0-9a-f-]{36}$/i.test(locationId)) {
      res.status(400).json({ ok: false, error: "A valid locationId is required" });
      return;
    }
    const repository = createDrizzleAuthRepository();
    const token = readSessionCookie(req.headers?.cookie);
    const user = token ? await authenticateSession(repository, token) : null;
    if (!user) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const context = await getAuthContext(repository, user);
    res.status(200).json(await getDashboard(context, locationId));
  } catch (error) {
    if (error instanceof Error && (error.message === "Location access required" || error.message === "Location not found")) {
      res.status(403).json({ ok: false, error: "Location access denied" });
      return;
    }
    console.error("Dashboard lookup failed", error instanceof Error ? error.message : "unknown error");
    res.status(500).json({ ok: false, error: "Unable to load dashboard" });
  }
}
