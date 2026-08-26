export async function sendSms(to: string, text: string): Promise<void> {
  const apiKey = process.env.INFOBIP_API_KEY;
  const from   = process.env.INFOBIP_FROM ?? "eKonobar";
  const baseUrl = process.env.INFOBIP_BASE_URL ?? "https://api.infobip.com";

  if (!apiKey) return;

  const res = await fetch(`${baseUrl}/sms/2/text/advanced`, {
    method: "POST",
    headers: {
      Authorization: `App ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          from,
          destinations: [{ to }],
          text: text.slice(0, 160),
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Infobip SMS failed (${res.status}): ${err}`);
  }
}
