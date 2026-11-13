import { createSessionForUser, SESSION_TTL_MS } from "../../src/server/auth/core.js";
import { hubSessionCookie } from "../../src/server/auth/cookies.js";
import { createDrizzleAuthRepository } from "../../src/server/auth/drizzle-repository.js";
import { hubAccountEmail, verifyHubPass } from "../../src/server/auth/hub-pass.js";

type Request = { method?: string; query?: Record<string, string | string[] | undefined> };
type Response = { setHeader: (name: string, value: string) => void; status: (code: number) => Response; end: () => void; json: (body: unknown) => void };

// GET /api/auth/hub?pass=… – opened by Le Feast Hub. Swaps a verified hub pass
// for a session as the compliance user mapped in HUB_EHO_ACCOUNTS, then opens
// the app. Anything invalid lands on the normal sign-in screen.
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  const goTo = (location: string) => {
    res.setHeader("Location", location);
    res.status(303).end();
  };
  try {
    const raw = req.query?.pass;
    const pass = verifyHubPass(Array.isArray(raw) ? raw[0] : raw, "eho");
    const email = hubAccountEmail(pass);
    if (!email) return goTo("/");
    const result = await createSessionForUser(createDrizzleAuthRepository(), { email });
    if (!result) return goTo("/");
    res.setHeader("Set-Cookie", hubSessionCookie(result.sessionToken, SESSION_TTL_MS / 1000));
    return goTo("/");
  } catch (error) {
    console.error("Hub sign-in failed", error instanceof Error ? error.message : "unknown error");
    return goTo("/");
  }
}
