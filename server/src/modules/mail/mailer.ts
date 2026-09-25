export interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Boîte de sortie en mémoire : tests + inspection dev (jamais d'effet de bord caché). */
export const mailOutbox: MailPayload[] = [];

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Envoi réel via Resend si RESEND_API_KEY est configurée, sinon journal
 * console (dev) + boîte de sortie. Ne jette que si le provider répond en erreur.
 */
export async function sendMail(payload: MailPayload): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    mailOutbox.push(payload);
    if (process.env.NODE_ENV !== "test") {
      console.log(`[mail:dev] to=${payload.to} subject=${payload.subject}`);
    }
    return;
  }
  const from = process.env.RESEND_FROM ?? "Focus <noreply@focus.app>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: payload.to, subject: payload.subject, html: payload.html, text: payload.text ?? stripTags(payload.html) }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Email provider error (${res.status}): ${body.slice(0, 200)}`);
  }
}

export function verificationEmail(firstName: string, code: string): MailPayload {
  return {
    to: "",
    subject: "Vérifiez votre adresse email — Focus",
    html: `<p>Bonjour ${firstName},</p><p>Votre code de vérification Focus :</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>Valable 10 minutes. Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message.</p>`,
  };
}

export function resetEmail(firstName: string, link: string): MailPayload {
  return {
    to: "",
    subject: "Réinitialisation de votre mot de passe — Focus",
    html: `<p>Bonjour ${firstName},</p><p>Cliquez sur ce lien (valable 1 heure) pour choisir un nouveau mot de passe :</p><p><a href="${link}">${link}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
  };
}
