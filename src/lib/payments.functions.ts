import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MIN_SATS = 1_000;
const MAX_SATS = 10_000_000;

export const createCoinbaseCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { amountSats: number; idempotencyKey: string }) => {
    if (!Number.isInteger(i?.amountSats) || i.amountSats < MIN_SATS || i.amountSats > MAX_SATS) throw new Error("Valor inválido");
    if (typeof i.idempotencyKey !== "string" || !/^[\w-]{8,64}$/.test(i.idempotencyKey)) throw new Error("Chave inválida");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { flags, createRealCoinbaseCheckout } = await import("@/lib/payments/coinbase.server");
    const f = flags();
    if (!f.realCoinbase && !f.mockPayments) throw new Error("Depósitos ainda não estão ativos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin.from("deposits")
      .select("id, checkout_url, status, expires_at")
      .eq("user_id", context.userId).eq("idempotency_key", data.idempotencyKey).maybeSingle();
    if (existing) return { depositId: existing.id, checkoutUrl: existing.checkout_url, status: existing.status, expiresAt: existing.expires_at };

    const { data: dep, error } = await supabaseAdmin.from("deposits").insert({
      user_id: context.userId, amount_sats: data.amountSats, idempotency_key: data.idempotencyKey,
      provider: f.realCoinbase ? "coinbase" : "mock",
    }).select("id").single();
    if (error || !dep) throw new Error("Não foi possível criar o depósito.");

    const co = f.realCoinbase
      ? await createRealCoinbaseCheckout({ amountSats: data.amountSats, depositId: dep.id })
      : { id: `mock_${dep.id}`, url: `/rifa?mock_checkout=${dep.id}`, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() };

    await supabaseAdmin.from("deposits").update({
      provider_checkout_id: co.id, checkout_url: co.url, expires_at: co.expiresAt, status: "waiting_payment",
    }).eq("id", dep.id);
    return { depositId: dep.id, checkoutUrl: co.url, status: "waiting_payment", expiresAt: co.expiresAt };
  });

export const getCoinbaseCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { depositId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(i?.depositId ?? "")) throw new Error("Depósito inválido");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { data: d } = await context.supabase.from("deposits")
      .select("id, status, amount_sats, checkout_url, expires_at, credited_at").eq("id", data.depositId).maybeSingle();
    if (!d) throw new Error("Depósito não encontrado");
    return d;
  });

/** Mock only: simulates a provider event for the caller's own deposit. */
export const simulateDepositEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { depositId: string; outcome: "pending" | "confirmed" | "expired" }) => {
    if (!/^[0-9a-f-]{36}$/i.test(i?.depositId ?? "") || !["pending", "confirmed", "expired"].includes(i.outcome)) throw new Error("Entrada inválida");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { flags, processPaymentEvent } = await import("@/lib/payments/coinbase.server");
    if (flags().realCoinbase || !flags().mockPayments) throw new Error("Simulação desativada.");
    const { data: own } = await context.supabase.from("deposits").select("id, provider").eq("id", data.depositId).maybeSingle();
    if (!own || own.provider !== "mock") throw new Error("Depósito não encontrado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return processPaymentEvent(supabaseAdmin, {
      provider: "mock", id: `mock_${data.depositId}_${data.outcome}`, type: `checkout.payment.${data.outcome}`,
      depositId: data.depositId, raw: { simulated: true, outcome: data.outcome },
    });
  });
