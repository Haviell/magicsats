import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/coinbase-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["COINBASE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });
        const raw = await request.text();
        if (raw.length > 200_000) return new Response("Too large", { status: 413 });

        const { verifyCoinbaseSignature, processPaymentEvent } = await import("@/lib/payments/coinbase.server");
        const ok = await verifyCoinbaseSignature(raw, request.headers.get("x-hook0-signature"), secret, request.headers);
        if (!ok) return new Response("Invalid signature", { status: 400 });

        let ev: Record<string, any>;
        try { ev = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }
        const id = String(ev.id ?? ev.eventId ?? "");
        const type = String(ev.type ?? ev.eventType ?? "");
        const obj = ev.data ?? ev.payload ?? {};
        if (!id || !type) return new Response("Missing fields", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        try {
          await processPaymentEvent(supabaseAdmin, {
            provider: "coinbase", id, type,
            checkoutId: obj.id ? String(obj.id) : undefined,
            depositId: obj.metadata?.depositId ? String(obj.metadata.depositId) : undefined,
            raw: ev,
          });
        } catch {
          return new Response("Retry", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
