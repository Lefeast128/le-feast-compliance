import axios from "axios";

export async function sendOtpEmail(email: string, code: string, expiryMinutes = 10) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY and AUTH_FROM_EMAIL are required");

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
}
