import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY missing — skipping send:", subject, "→", to);
    return { skipped: true as const };
  }

  const resend = new Resend(resendApiKey);
  const from = process.env.EMAIL_FROM || "Sundays in LA <onboarding@resend.dev>";

  const result = await resend.emails.send({ from, to, subject, html });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result;
}
