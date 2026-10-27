// Server-only Resend integration. Never import from browser code.
// Privacy: emails are never logged in full and never returned to the client.

const RESEND_URL = "https://api.resend.com/emails";

export function isResendConfigured() {
  return Boolean(process.env["RESEND_API_KEY"]);
}

export function maskEmail(email: string) {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}***@${domain.slice(0, 1)}***`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function wrap(content: string, preview = "", footerExtra = "") {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MagicSats</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111">
${preview ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div>` : ""}
<div style="max-width:560px;margin:24px auto;border:3px solid #000;border-radius:14px;overflow:hidden;box-shadow:6px 8px 0 #000">
<div style="background:#111;padding:20px;text-align:center;color:#f97316;font-size:22px;font-weight:800">⚡ MagicSats</div>
<div style="padding:28px 24px;font-size:15px;line-height:1.6">${content}</div>
<div style="padding:16px 24px;background:#f5f5f5;font-size:12px;color:#666;text-align:center">
🛡️ Nunca pedimos sua senha ou chaves privadas por e-mail.${footerExtra}</div></div></body></html>`;
}

const btn = (url: string, label: string) =>
  `<a href="${escapeHtml(url)}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;border:2px solid #000">${escapeHtml(label)}</a>`;

export type SendResult = { success: boolean; error?: string };

async function send(to: string, subject: string, html: string, headers?: Record<string, string>): Promise<SendResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return { success: false, error: "resend_not_configured" };
  const from = process.env["RESEND_FROM_EMAIL"] || "MagicSats <nao-responda@magicsats.digital>";
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, headers }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[resend] falha ${res.status} para ${maskEmail(to)}: ${body}`);
    return { success: false, error: `resend_${res.status}` };
  }
  return { success: true };
}

export function sendPasswordResetEmail(p: { to: string; nickname: string; resetUrl: string }) {
  return send(
    p.to,
    "Redefinição de senha — MagicSats",
    wrap(
      `<p>Olá, <b>@${escapeHtml(p.nickname)}</b>.</p><p>Recebemos um pedido para redefinir sua senha. O link expira em breve.</p><p>${btn(p.resetUrl, "Criar nova senha")}</p><p style="font-size:13px;color:#666">Se não foi você, ignore este e-mail. Sua conta continua segura.</p>`,
      "Crie uma nova senha para sua conta",
    ),
  );
}

export function sendSignupConfirmationEmail(p: { to: string; nickname: string; confirmUrl: string }) {
  return send(
    p.to,
    "Confirme sua conta — MagicSats",
    wrap(
      `<p>Bem-vindo, <b>@${escapeHtml(p.nickname)}</b>!</p><p>Confirme seu e-mail para ativar sua conta anônima.</p><p>${btn(p.confirmUrl, "Confirmar e-mail")}</p>`,
      "Ative sua conta MagicSats",
    ),
  );
}

export function sendWinnerEmail(p: { to: string; nickname: string; roundNumber: number; winningNumber: number; prizeSatoshis: number; claimUrl: string }) {
  return send(
    p.to,
    `🏆 Você venceu a Rodada #${p.roundNumber}!`,
    wrap(
      `<p>Parabéns, <b>@${escapeHtml(p.nickname)}</b>!</p><p>Seu número <b>${p.winningNumber}</b> venceu a Rodada #${p.roundNumber} — prêmio de <b>${p.prizeSatoshis.toLocaleString("pt-BR")} sats</b>.</p><p>Como vencedor, você tem acesso antecipado à próxima rodada e pode garantir o mesmo número <b>${p.winningNumber}</b>.</p><p>${btn(p.claimUrl, "Garantir meu número")}</p>`,
      "Você ganhou! Garanta seu número na próxima rodada",
    ),
  );
}

export function sendPromotionalEmail(p: { to: string; nickname: string; subject: string; bodyText: string; ctaUrl?: string; ctaLabel?: string; unsubscribeUrl: string }) {
  const paragraphs = p.bodyText
    .split(/\n{2,}/)
    .map((t) => `<p>${escapeHtml(t).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return send(
    p.to,
    p.subject,
    wrap(
      `<p>Olá, <b>@${escapeHtml(p.nickname)}</b>!</p>${paragraphs}${p.ctaUrl ? `<p>${btn(p.ctaUrl, p.ctaLabel || "Ver agora")}</p>` : ""}`,
      p.subject,
      `<br><br>Você recebe este e-mail porque aceitou novidades. <a href="${escapeHtml(p.unsubscribeUrl)}">Cancelar inscrição</a>`,
    ),
    { "List-Unsubscribe": `<${p.unsubscribeUrl}>` },
  );
}
