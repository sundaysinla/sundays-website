/**
 * Text messages via Twilio's REST API. With no TWILIO_* env set, sends are
 * logged and skipped so the rest of the flow keeps working.
 */
export async function sendSms(to: string, body: string): Promise<{ sent: boolean }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    console.info("[sms] Twilio not configured — skipping text to", to.replace(/\d(?=\d{4})/g, "•"));
    return { sent: false };
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1500) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Twilio ${res.status}: ${text.slice(0, 200)}`);
  }
  return { sent: true };
}
