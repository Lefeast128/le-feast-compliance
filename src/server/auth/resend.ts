import axios from "axios";

const sanitize = (value: unknown) => String(value ?? "")
  .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
  .replace(/\bre_[A-Za-z0-9_-]+\b/g, "[redacted]")
  .replace(/\b\d{6}\b/g, "[redacted]")
  .replace(/[\r\n]+/g, " ")
  .trim()
  .slice(0, 240);

export class ResendDeliveryError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly safeMessage: string;

  constructor(input: { status?: number; code?: string; safeMessage: string }) {
    super(input.safeMessage);
    this.name = "ResendDeliveryError";
    this.status = input.status;
    this.code = input.code;
    this.safeMessage = input.safeMessage;
  }
}

export const toResendDeliveryError = (error: unknown) => {
  if (error instanceof ResendDeliveryError) return error;

  if (axios.isAxiosError(error)) {
    const response = error.response;
    const data = response?.data as { name?: unknown; type?: unknown; code?: unknown; message?: unknown } | undefined;
    const code = sanitize(data?.code ?? data?.name ?? data?.type) || undefined;
    const safeMessage = sanitize(data?.message) || "Resend rejected the email request";
    return new ResendDeliveryError({
      status: response?.status,
      code,
      safeMessage,
    });
  }

  return new ResendDeliveryError({
    safeMessage: "Resend email delivery failed",
  });
};

export async function sendOtpEmail(email: string, code: string, expiryMinutes = 10) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new ResendDeliveryError({ safeMessage: "Resend configuration is missing" });
  }

  try {
    await axios.post("https://api.resend.com/emails", {
      from,
      to: [email],
      subject: "Your Le Feast login code",
      text: [
        "Le Feast Compliance",
        `Your verification code is: ${code}`,
        `This code expires in ${expiryMinutes} minutes.`,
        "If you did not request this code, you can ignore this email.",
      ].join("\n"),
    }, { headers: { Authorization: `Bearer ${apiKey}` } });
  } catch (error) {
    throw toResendDeliveryError(error);
  }
}

export async function sendInvitationEmail(input: {
  email: string;
  recipientName: string;
  inviterName: string | null;
  locations: string[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new ResendDeliveryError({ safeMessage: "Resend configuration is missing" });
  }

  const inviter = input.inviterName?.trim() || "Your organisation administrator";
  const appUrl = process.env.APP_URL ?? "https://le-feast-compliance.vercel.app";
  const access = input.locations.join(", ");
  try {
    await axios.post("https://api.resend.com/emails", {
      from,
      to: [input.email],
      subject: "You've been invited to Le Feast Compliance",
      text: [
        "Le Feast Compliance",
        `Hello ${input.recipientName},`,
        `${inviter} has given you access to Le Feast Compliance.`,
        "",
        `Your access: ${access}`,
        "Use your invited email address to sign in securely with a verification code.",
        `Open Le Feast Compliance: ${appUrl}`,
      ].join("\n"),
    }, { headers: { Authorization: `Bearer ${apiKey}` } });
  } catch (error) {
    throw toResendDeliveryError(error);
  }
}
