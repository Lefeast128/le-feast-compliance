import { assertMutationOrigin } from "../../src/server/auth/cookies.js";
import { requestOtp } from "../../src/server/auth/core.js";
import { createDrizzleAuthRepository } from "../../src/server/auth/drizzle-repository.js";
import { sendOtpEmail } from "../../src/server/auth/resend.js";

type Request = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void };

const bodyOf = (body: unknown) => typeof body === "string" ? JSON.parse(body) as { email?: string } : body as { email?: string };

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    assertMutationOrigin(req);
    const body = bodyOf(req.body);
    if (!body?.email || typeof body.email !== "string") {
      res.status(400).json({ ok: false, error: "Email is required" });
      return;
    }
    const forwardedFor = req.headers?.["x-forwarded-for"];
    const rateLimitKey = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]?.trim();
    const result = await requestOtp(createDrizzleAuthRepository(), {
      email: body.email,
      rateLimitKey,
      send: sendOtpEmail,
    });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      res.status(400).json({ ok: false, error: "Invalid JSON" });
      return;
    }
    console.error("OTP request failed", error instanceof Error ? error.message : "unknown error");
    res.status(500).json({ ok: false, error: "Unable to request a verification code" });
  }
}
