import { logoutSession } from "../../src/server/auth/core.js";
import { assertMutationOrigin, clearSessionCookie, readSessionCookie } from "../../src/server/auth/cookies.js";
import { createDrizzleAuthRepository } from "../../src/server/auth/drizzle-repository.js";

type Request = { method?: string; headers?: Record<string, string | string[] | undefined> };
type Response = { setHeader: (name: string, value: string) => void; status: (code: number) => Response; json: (body: unknown) => void };

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    assertMutationOrigin(req);
    const token = readSessionCookie(req.headers?.cookie);
    if (token) await logoutSession(createDrizzleAuthRepository(), token);
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.status(200).json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") {
      res.status(403).json({ ok: false, error: error.message });
      return;
    }
    console.error("Logout failed", error instanceof Error ? error.message : "unknown error");
    res.status(500).json({ ok: false, error: "Unable to log out" });
  }
}
