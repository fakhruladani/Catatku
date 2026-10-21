import "server-only";

/**
 * Pengiriman email.
 * EMAIL_TRANSPORT:
 *  - "console" (default dev): isi email dicetak ke log server
 *  - "resend": kirim lewat Resend (RESEND_API_KEY, EMAIL_FROM)
 *  - "memory": disimpan di outbox (dipakai test)
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const globalOutbox = globalThis as unknown as { __catatkuOutbox?: EmailMessage[] };
export const outbox: EmailMessage[] = (globalOutbox.__catatkuOutbox ??= []);

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const transport = process.env.EMAIL_TRANSPORT ?? "console";
  if (transport === "memory") {
    outbox.push(msg);
    return;
  }
  if (transport === "resend") {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Catatku <no-reply@example.com>",
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    if (error) throw new Error(`Gagal mengirim email: ${error.message}`);
    return;
  }
  console.info(
    `\n────── EMAIL (console) ──────\nKepada : ${msg.to}\nSubjek : ${msg.subject}\n\n${msg.text}\n─────────────────────────────\n`,
  );
}

function layout(title: string, body: string, cta: { label: string; url: string }): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f6f6f6;padding:24px">
<div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;padding:24px">
<h2 style="margin-top:0">${title}</h2><p>${body}</p>
<p><a href="${cta.url}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${cta.label}</a></p>
<p style="color:#666;font-size:12px">Jika tombol tidak berfungsi, salin tautan ini:<br>${cta.url}</p>
<p style="color:#666;font-size:12px">Abaikan email ini jika kamu tidak merasa memintanya.</p>
</div></body></html>`;
}

export function verificationEmail(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: "Verifikasi email akun Catatku",
    text: `Halo ${name},\n\nKlik tautan berikut untuk memverifikasi email kamu (berlaku 1 jam):\n${url}`,
    html: layout(`Halo ${escapeHtml(name)}`, "Klik tombol di bawah untuk memverifikasi email kamu. Tautan berlaku 1 jam.", {
      label: "Verifikasi email",
      url,
    }),
  };
}

export function resetPasswordEmail(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: "Reset password Catatku",
    text: `Halo ${name},\n\nKlik tautan berikut untuk membuat password baru (berlaku 1 jam):\n${url}`,
    html: layout(`Halo ${escapeHtml(name)}`, "Kami menerima permintaan reset password. Tautan berlaku 1 jam.", {
      label: "Buat password baru",
      url,
    }),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
