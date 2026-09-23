import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.AUTH_FROM_EMAIL;
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
    if (!from) throw new Error("AUTH_FROM_EMAIL is not configured");

    try {
      await axios.post(
        "https://api.resend.com/emails",
        {
          from,
          to: [email],
          subject: "Your Le Feast login code",
          text: `Your Le Feast login code is ${token}. It expires in 15 minutes.`,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
