import { Resend } from 'resend'

// Instância do Resend (inicializada no servidor)
const apiKey = process.env.RESEND_API_KEY || ''
export const resend = new Resend(apiKey)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'MagicSats <nao-responda@magicsats.digital>'

interface EmailResult {
  success: boolean
  id?: string
  error?: string
}

/**
 * Template base de e-mail neutro e anônimo (sem rastreadores invasivos)
 */
function wrapHtmlContent(contentHtml: string, previewText: string = ''): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MagicSats</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6; }
    .container { max-width: 560px; margin: 30px auto; background-color: #111827; border: 3px solid #f97316; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.6); }
    .header { background: linear-gradient(135deg, #1f2937, #111827); padding: 24px; text-align: center; border-bottom: 2px solid #374151; }
    .logo { font-size: 24px; font-weight: 800; color: #f97316; letter-spacing: -0.5px; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; color: #e5e7eb; }
    .btn { display: inline-block; background-color: #f97316; color: #ffffff !important; text-decoration: none; font-weight: 700; padding: 14px 28px; border-radius: 8px; margin: 20px 0; border: 2px solid #ea580c; text-align: center; font-size: 15px; }
    .box { background-color: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .footer { padding: 20px 24px; background-color: #0d121f; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #1f2937; }
    .highlight { color: #f97316; font-weight: 700; }
  </style>
</head>
<body>
  ${previewText ? `<div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ''}
  <div class="container">
    <div class="header">
      <div class="logo">⚡ MagicSats</div>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">
      <p>MagicSats • Rifas Descentralizadas em Bitcoin</p>
      <p style="font-size: 11px; color: #6b7280; margin-top: 6px;">
        🛡️ Comunicação segura e anônima. Jamais solicitamos sua senha ou chaves privadas por e-mail.
      </p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Envia e-mail de recuperação de senha
 */
export async function sendPasswordResetEmail({
  to,
  nickname,
  resetUrl,
}: {
  to: string
  nickname: string
  resetUrl: string
}): Promise<EmailResult> {
  try {
    const html = wrapHtmlContent(`
      <h2 style="margin-top:0; color:#ffffff;">Recuperação de Acesso</h2>
      <p>Olá, <span class="highlight">@${nickname}</span>!</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>MagicSats</strong>.</p>
      <div style="text-align: center;">
        <a href="${resetUrl}" class="btn">Redefinir Minha Senha</a>
      </div>
      <p style="font-size: 13px; color: #9ca3af;">
        Se você não solicitou esta alteração, ignore este e-mail. Seus dados permanecem seguros e nenhuma ação será tomada.
      </p>
      <p style="font-size: 12px; color: #6b7280; word-break: break-all;">
        Link alternativo: <br>${resetUrl}
      </p>
    `, 'Redefinição de senha da sua conta MagicSats')

    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'MagicSats - Redefinição de Senha',
      html,
    })

    if (response.error) {
      return { success: false, error: response.error.message }
    }
    return { success: true, id: response.data?.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao enviar e-mail' }
  }
}

/**
 * Envia notificação de vitória com concessão de privilégio exclusivo para a próxima rifa
 */
export async function sendWinnerNotificationEmail({
  to,
  nickname,
  roundNumber,
  winningNumber,
  prizeSatoshis,
  claimUrl,
}: {
  to: string
  nickname: string
  roundNumber: number
  winningNumber: number
  prizeSatoshis: number
  claimUrl: string
}): Promise<EmailResult> {
  try {
    const btcAmount = (prizeSatoshis / 100000000).toFixed(8)
    const html = wrapHtmlContent(`
      <h2 style="margin-top:0; color:#22c55e;">🎉 Parabéns, você é o vencedor!</h2>
      <p>Saudações, <span class="highlight">@${nickname}</span>!</p>
      <p>Você foi o grande ganhador do <strong>Round #${roundNumber}</strong> com o número da sorte <strong>#${winningNumber}</strong>!</p>
      
      <div class="box">
        <div style="font-size: 13px; color: #9ca3af;">Prêmio Conquistado:</div>
        <div style="font-size: 24px; font-weight: 800; color: #f97316; margin: 4px 0;">
          ${prizeSatoshis.toLocaleString('pt-BR')} SATOSHIS
        </div>
        <div style="font-size: 13px; color: #9ca3af;">(${btcAmount} BTC)</div>
      </div>

      <div style="background-color: #272015; border: 1px solid #f97316; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h4 style="margin: 0 0 8px 0; color: #fbbf24;">⭐ Seu Privilégio Exclusivo de Vencedor:</h4>
        <p style="margin: 0; font-size: 14px; color: #fef3c7;">
          Como vencedor deste round, você acaba de desbloquear <strong>acesso prioritário antecipado ao Round #${roundNumber + 1}</strong>! 
          Você tem a preferência exclusiva para garantir e reservar o seu mesmo número campeão (<strong>#${winningNumber}</strong>) antes que a rifa abra ao público geral!
        </p>
      </div>

      <div style="text-align: center;">
        <a href="${claimUrl}" class="btn">Garantir Meu Número na Próxima Rifa</a>
      </div>
    `, `Você venceu o Round #${roundNumber} no MagicSats! Acesse seu privilégio exclusivo.`)

    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `🏆 Parabéns! Você venceu a rifa Round #${roundNumber} no MagicSats`,
      html,
    })

    if (response.error) {
      return { success: false, error: response.error.message }
    }
    return { success: true, id: response.data?.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao enviar notificação' }
  }
}

/**
 * Envia e-mails promocionais / de aviso com proteção máxima de anonimato.
 * NUNCA coloca destinatários em grupo ou no mesmo campo 'to', evitando vazamento de dados.
 */
export async function sendPromotionalCampaign({
  recipients,
  subject,
  title,
  body,
  ctaText,
  ctaUrl,
}: {
  recipients: Array<{ email: string; nickname?: string }>
  subject: string
  title: string
  body: string
  ctaText?: string
  ctaUrl?: string
}): Promise<{ totalSent: number; errors: number }> {
  let totalSent = 0
  let errors = 0

  // Envio individual e isolado para garantir 100% de privacidade (sem vazamento de e-mails)
  for (const recipient of recipients) {
    try {
      const displayNick = recipient.nickname || 'Participante'
      const personalizedBody = body.replace(/{{nickname}}/g, `@${displayNick}`)

      const html = wrapHtmlContent(`
        <h2 style="margin-top:0; color:#ffffff;">${title}</h2>
        <p>Olá, <span class="highlight">@${displayNick}</span>,</p>
        <div>${personalizedBody}</div>
        ${
          ctaText && ctaUrl
            ? `<div style="text-align: center; margin-top: 24px;">
                <a href="${ctaUrl}" class="btn">${ctaText}</a>
              </div>`
            : ''
        }
      `, subject)

      const response = await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient.email,
        subject,
        html,
      })

      if (response.error) {
        errors++
      } else {
        totalSent++
      }
    } catch {
      errors++
    }
  }

  return { totalSent, errors }
}
