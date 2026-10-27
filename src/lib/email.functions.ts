import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores.");
}

/** Admin-only: notify the winner of a round (one recipient). */
export const notifyRoundWinner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roundNumber: number; origin: string }) => {
    const roundNumber = Number(input?.roundNumber);
    if (!Number.isInteger(roundNumber) || roundNumber < 0) throw new Error("Rodada inválida.");
    if (!/^https?:\/\/[^/]+$/.test(String(input?.origin))) throw new Error("Origem inválida.");
    return { roundNumber, origin: String(input.origin) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWinnerEmail, isResendConfigured } = await import("@/lib/email/resend.server");
    if (!isResendConfigured()) return { sent: false, reason: "resend_not_configured" };
    const { data: w } = await supabaseAdmin
      .from("raffle_winners")
      .select("user_id, winning_number, prize_satoshis")
      .eq("round_number", data.roundNumber)
      .maybeSingle();
    if (!w?.user_id) return { sent: false, reason: "no_winner" };
    const [{ data: u }, { data: p }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(w.user_id),
      supabaseAdmin.from("profiles").select("username, transactional_opt_in").eq("id", w.user_id).maybeSingle(),
    ]);
    if (!u?.user?.email || p?.transactional_opt_in === false) return { sent: false, reason: "opted_out" };
    const result = await sendWinnerEmail({
      to: u.user.email,
      nickname: p?.username ?? "vencedor",
      roundNumber: data.roundNumber,
      winningNumber: w.winning_number,
      prizeSatoshis: Number(w.prize_satoshis),
      claimUrl: `${data.origin}/rifa?round=${data.roundNumber + 1}`,
    });
    return { sent: result.success, reason: result.error };
  });

/**
 * Admin-only: promotional campaign. Only users who opted in receive it,
 * each e-mail goes to a single recipient (no shared To/CC lists).
 */
export const sendPromotionalCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subject: string; bodyText: string; ctaUrl?: string; ctaLabel?: string; origin: string }) => {
    const subject = String(input?.subject ?? "").trim();
    const bodyText = String(input?.bodyText ?? "").trim();
    if (!subject || subject.length > 150) throw new Error("Assunto inválido.");
    if (!bodyText || bodyText.length > 5000) throw new Error("Mensagem inválida.");
    if (input.ctaUrl && !/^https:\/\//.test(input.ctaUrl)) throw new Error("Link precisa começar com https://");
    if (!/^https?:\/\/[^/]+$/.test(String(input?.origin))) throw new Error("Origem inválida.");
    return { subject, bodyText, ctaUrl: input.ctaUrl, ctaLabel: input.ctaLabel?.slice(0, 40), origin: String(input.origin) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPromotionalEmail, isResendConfigured } = await import("@/lib/email/resend.server");
    if (!isResendConfigured()) return { sent: 0, failed: 0, reason: "resend_not_configured" };
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .eq("marketing_opt_in", true)
      .limit(500);
    let sent = 0;
    let failed = 0;
    for (const p of profiles ?? []) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
      if (!u?.user?.email) continue;
      const r = await sendPromotionalEmail({
        to: u.user.email,
        nickname: p.username,
        subject: data.subject,
        bodyText: data.bodyText,
        ctaUrl: data.ctaUrl,
        ctaLabel: data.ctaLabel,
        unsubscribeUrl: `${data.origin}/rifa?preferencias=email`,
      });
      r.success ? sent++ : failed++;
    }
    return { sent, failed };
  });
