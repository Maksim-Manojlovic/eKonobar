export async function sendWhatsApp(to: string, title: string, body: string): Promise<void> {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const token        = process.env.WA_ACCESS_TOKEN;
  const template     = process.env.WA_TEMPLATE_NAME ?? "ekonobar_notification";

  if (!phoneNumberId || !token) return;

  // Normalize: strip leading +, add country code if missing
  const normalized = to.replace(/\D/g, "");

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalized,
        type: "template",
        template: {
          name: template,
          language: { code: "sr" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: title },
                { type: "text", text: body },
              ],
            },
          ],
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`WhatsApp send failed (${res.status}): ${err}`);
  }
}
