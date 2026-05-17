import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   ?? "smtp.gmail.com",
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM ?? "eKonobar <noreply@ekonobar.rs>";
const APP  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function sendPasswordResetEmail(
  toEmail: string,
  token: string,
) {
  const link = `${APP}/reset-password?token=${token}`;

  await transporter.sendMail({
    from:    FROM,
    to:      toEmail,
    subject: "Resetuj lozinku — eKonobar",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
        <div style="height:3px;background:linear-gradient(90deg,#f97316,#ea580c);border-radius:2px;margin-bottom:32px;"></div>
        <h2 style="color:#111;font-size:20px;font-weight:800;margin:0 0 8px;">Resetuj lozinku</h2>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
          Primili smo zahtev za resetovanje lozinke za nalog vezan za ovu adresu.<br>
          Klikni na dugme ispod da postaviš novu lozinku. Link važi <strong>1 sat</strong>.
        </p>
        <a href="${link}" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:12px;">
          Resetuj lozinku →
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:32px;line-height:1.5;">
          Ako nisi tražio/la reset, možeš zanemariti ovaj email.<br>
          Lozinka se neće promeniti dok ne klikneš na link.
        </p>
        <div style="height:1px;background:#eee;margin:24px 0;"></div>
        <p style="color:#ccc;font-size:11px;margin:0;">eKonobar · platforma za ugostiteljski sektor u Srbiji</p>
      </div>
    `,
    text: `Resetuj lozinku na eKonobar-u.\n\nLink (važi 1 sat):\n${link}\n\nAko nisi tražio/la reset, zanemari ovaj email.`,
  });
}
