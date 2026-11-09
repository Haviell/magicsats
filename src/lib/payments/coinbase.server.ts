// Server-only Coinbase Business (Checkouts API) helpers. Never import from browser code.
import type { SupabaseClient } from "@supabase/supabase-js";

export type DepositStatus =
  | "created" | "waiting_payment" | "processing" | "confirmed" | "completed"
  | "expired" | "failed" | "partial" | "overpaid";

export const flags = () => ({
  realCoinbase: process.env["ENABLE_REAL_COINBASE"] === "true",
  // Mock payments must be switched on explicitly: they credit simulated balance.
  mockPayments: process.env["ENABLE_MOCK_PAYMENTS"] === "true",
  realWithdrawals: process.env["ENABLE_REAL_WITHDRAWALS"] === "true",
});

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function safeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Official scheme: X-Hook0-Signature "t=..,h=..,v1=.." ; HMAC-SHA256(secret, `${t}.${h}.${headerValues}.${body}`). */
export async function verifyCoinbaseSignature(
  rawBody: string, header: string | null, secret: string, headers: Headers,
  nowMs = Date.now(), maxAgeMin = 5,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => {
    const i = p.indexOf("=");
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  }));
  const t = parts["t"], h = parts["h"] ?? "", v1 = parts["v1"];
  if (!t || !v1 || !/^\d+$/.test(t)) return false;
  if (Math.abs(nowMs - Number(t) * 1000) > maxAgeMin * 60_000) return false;
  const headerValues = h.split(" ").filter(Boolean).map((n) => headers.get(n) ?? "").join(".");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${h}.${headerValues}.${rawBody}`)));
  return safeEqualHex(sig, v1.toLowerCase());
}

/** Maps a provider event type to our deposit status. Confirm exact names against the Coinbase dashboard. */
export function statusFromEvent(type: string): DepositStatus | null {
  const t = type.toLowerCase();
  if (/(success|completed|confirmed|paid)/.test(t)) return "confirmed";
  if (/expired/.test(t)) return "expired";
  if (/(failed|cancel)/.test(t)) return "failed";
  if (/(pending|processing|detected)/.test(t)) return "processing";
  return null;
}

export interface ProviderEvent {
  provider: "coinbase" | "mock";
  id: string;
  type: string;
  checkoutId?: string | undefined;
  depositId?: string | undefined;
  raw: unknown;
}

/** Idempotent: records the event once, updates status, credits only on confirmed. */
export async function processPaymentEvent(admin: SupabaseClient, ev: ProviderEvent) {
  let q = admin.from("deposits").select("id, status, credited_at");
  q = ev.depositId ? q.eq("id", ev.depositId) : q.eq("provider_checkout_id", ev.checkoutId ?? "__none__");
  const { data: dep } = await q.maybeSingle();

  const { error: insErr } = await admin.from("payment_provider_events").insert({
    provider: ev.provider, external_event_id: ev.id, event_type: ev.type,
    deposit_id: dep?.id ?? null, payload: ev.raw as never,
  });
  if (insErr) {
    if (insErr.code === "23505") return { duplicate: true };
    throw new Error("event_store_failed");
  }
  if (!dep) return { unknownDeposit: true };

  const status = statusFromEvent(ev.type);
  if (status && !dep.credited_at && dep.status !== "completed") {
    await admin.from("deposits").update({ status, updated_at: new Date().toISOString() }).eq("id", dep.id);
    if (status === "confirmed") await admin.rpc("credit_confirmed_deposit", { _deposit_id: dep.id });
  }
  await admin.from("payment_provider_events").update({ processed_at: new Date().toISOString() })
    .eq("provider", ev.provider).eq("external_event_id", ev.id);
  return { ok: true, status };
}

/** Real call placeholder — stays disabled until ENABLE_REAL_COINBASE=true and the request is confirmed against current docs. */
export async function createRealCoinbaseCheckout(_input: { amountSats: number; depositId: string }): Promise<{ id: string; url: string; expiresAt: string | null }> {
  throw new Error("Integração real com a Coinbase ainda não foi ativada.");
}
