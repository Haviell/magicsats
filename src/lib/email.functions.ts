import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Pending email migration: keep its contract separate from generated live types.
// Database errors remain fail-closed: no campaign is sent without a saved token.
type UnsubscribeToken = {
  token_hash: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
};
type EmailDatabase = Database & {
  public: {
    Tables: {
      email_unsubscribe_tokens: {
        Row: UnsubscribeToken;
        Insert: Omit<UnsubscribeToken, "used_at"> & { used_at?: string | null };
        Update: Partial<UnsubscribeToken>;
        Relationships: [];
      };
    };
  };
};

function getTrustedOrigin(requestedOrigin: string) {
  const request = getRequest();
  const requestOrigin = new URL(request.url).origin;
  const browserOrigin = request.headers.get("origin");
  if (requestedOrigin !== requestOrigin || (browserOrigin && browserOrigin !== requestOrigin)) {
    throw new Error("Origem inválida.");
  }
  return requestOrigin;
}

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
    const origin = getTrustedOrigin(data.origin);
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
      claimUrl: `${origin}/rifa?round=${data.roundNumber + 1}`,
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
    const origin = getTrustedOrigin(data.origin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPromotionalEmail, isResendConfigured } = await import("@/lib/email/resend.server");
    if (!isResendConfigured()) return { sent: 0, failed: 0, reason: "resend_not_configured" };
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .eq("marketing_opt_in", true)
      .limit(500);
    if (profilesError) throw new Error("Não foi possível carregar as preferências de e-mail.");

    const { randomBytes, createHash } = await import("node:crypto");
    let sent = 0;
    let failed = 0;
    for (const p of profiles ?? []) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
      if (!u?.user?.email) {
        failed++;
        continue;
      }

      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const { error: tokenError } = await (supabaseAdmin as SupabaseClient<EmailDatabase>)
        .from("email_unsubscribe_tokens")
        .insert({ token_hash: tokenHash, user_id: p.id, expires_at: expiresAt });
      if (tokenError) {
        failed++;
        continue;
      }

      const unsubscribeUrl = `${origin}/rifa#unsubscribe=${token}`;
      let delivered = false;
      try {
        const result = await sendPromotionalEmail({
          to: u.user.email,
          nickname: p.username,
          subject: data.subject,
          bodyText: data.bodyText,
          ctaUrl: data.ctaUrl,
          ctaLabel: data.ctaLabel,
          unsubscribeUrl,
        });
        delivered = result.success;
      } catch {
        console.error("[emails] promotional delivery failed");
      }

      if (delivered) {
        sent++;
      } else {
        failed++;
        const { error: revokeError } = await (supabaseAdmin as SupabaseClient<EmailDatabase>)
          .from("email_unsubscribe_tokens")
          .delete()
          .eq("token_hash", tokenHash);
        if (revokeError) {
          throw new Error("Falha ao limpar o token de cancelamento de e-mail.");
        }
      }
    }
    return { sent, failed };
  });

/** Unsubscribe by a random, single-use token without disclosing account details. */
export const unsubscribeFromMarketing = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => {
    const token = String(input?.token ?? "");
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Link inválido.");
    return { token };
  })
  .handler(async ({ data }) => {
    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(data.token).digest("hex");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data: savedToken, error: tokenError } = await (supabaseAdmin as SupabaseClient<EmailDatabase>)
      .from("email_unsubscribe_tokens")
      .select("user_id")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", now)
      .maybeSingle();

    if (tokenError) throw new Error("Não foi possível atualizar sua preferência.");
    if (!savedToken) {
      return { success: true, message: "Se o link ainda estiver válido, a preferência será atualizada." };
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ marketing_opt_in: false })
      .eq("id", savedToken.user_id);
    if (profileError) throw new Error("Não foi possível atualizar sua preferência.");

    const { error: revokeError } = await (supabaseAdmin as SupabaseClient<EmailDatabase>)
      .from("email_unsubscribe_tokens")
      .update({ used_at: now })
      .eq("user_id", savedToken.user_id)
      .is("used_at", null);
    if (revokeError) throw new Error("Preferência atualizada, mas não foi possível revogar os links.");

    return { success: true, message: "Sua preferência de e-mails promocionais foi atualizada." };
  });
