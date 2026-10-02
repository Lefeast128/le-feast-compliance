import { assertMutationOrigin } from "../../src/server/auth/cookies.js";
import { requestOtp, type AuthRepository } from "../../src/server/auth/core.js";
import { ResendDeliveryError, sendOtpEmail } from "../../src/server/auth/resend.js";

type Request = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };
type Response = { status: (code: number) => Response; json: (body: unknown) => void };

const bodyOf = (body: unknown) => typeof body === "string" ? JSON.parse(body) as { email?: string } : body as { email?: string };

type Dependencies = {
  repository: AuthRepository;
  send: (email: string, code: string) => Promise<void>;
};

export async function handleRequestOtp(req: Request, res: Response, dependencies?: Dependencies) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    assertMutationOrigin(req);
    const body = bodyOf(req.body);
    if (typeof body?.email !== "string" || !body.email.trim()) {
      res.status(400).json({ ok: false, error: "Email is required" });
      return;
    }
    const forwardedFor = req.headers?.["x-forwarded-for"];
    const rateLimitKey = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]?.trim();
    const repository = dependencies?.repository ?? (await import("../../src/server/auth/drizzle-repository.js")).createDrizzleAuthRepository();
    const result = await requestOtp(repository, {
      email: body.email,
      rateLimitKey,
      send: dependencies?.send ?? sendOtpEmail,
    });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      res.status(400).json({ ok: false, error: "Invalid JSON" });
      return;
    }
    if (error instanceof Error && error.message === "Invalid request origin") {
      console.error("OTP request rejected", { category: "invalid_origin" });
      res.status(403).json({ ok: false, error: "Invalid request origin" });
      return;
    }
    if (error instanceof ResendDeliveryError) {
      console.error("OTP email delivery failed", {
        category: "resend_delivery",
        status: error.status,
        code: error.code,
        message: error.safeMessage,
      });
      res.status(502).json({ ok: false, error: "Unable to send verification email" });
      return;
    }
    console.error("OTP request failed", { category: "internal_error" });
    res.status(500).json({ ok: false, error: "Unable to request a verification code" });
  }
}

export default async function handler(req: Request, res: Response) {
  return handleRequestOtp(req, res);
}
