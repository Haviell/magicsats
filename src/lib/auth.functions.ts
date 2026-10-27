import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GENERIC_LOGIN_ERROR = "E-mail/Nickname ou senha incorretos.";
const GENERIC_RESET_MESSAGE = "Se este e-mail estiver cadastrado, as instruções foram enviadas.";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/**
 * Sign in with e-mail OR nickname + password. The nickname -> e-mail lookup
 * happens only on the server, so e-mails are never exposed to the browser.
 */
export const loginWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input: { identifier: string; password: string }) => {
    const identifier = String(input?.identifier ?? "").trim();
    const password = String(input?.password ?? "");
    if (!identifier || identifier.length > 254 || !password || password.length > 200) {
      throw new Error(GENERIC_LOGIN_ERROR);
    }
    return { identifier, password };
  })
  .handler(async ({ data }) => {
    let email = data.identifier.toLowerCase();
    if (!email.includes("@")) {
      const nick = email.replace(/^@/, "");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("username", nick)
        .maybeSingle();
      if (!profile) throw new Error(GENERIC_LOGIN_ERROR);
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      if (!u?.user?.email) throw new Error(GENERIC_LOGIN_ERROR);
      email = u.user.email;
    }
    const { data: session, error } = await publicClient().auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !session.session) {
      if (error?.message?.toLowerCase().includes("not confirmed")) {
        throw new Error("Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.");
      }
      throw new Error(GENERIC_LOGIN_ERROR);
    }
    return {
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    };
  });

/**
 * Password reset. Uses Resend when RESEND_API_KEY is set; otherwise falls back
 * to the built-in auth e-mail. Always returns the same generic message.
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; origin: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    const origin = String(input?.origin ?? "");
    if (!email.includes("@") || email.length > 254) throw new Error("Informe um e-mail válido.");
    if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error("Origem inválida.");
    return { email, origin };
  })
  .handler(async ({ data }) => {
    const redirectTo = `${data.origin}/auth/redefinir-senha`;
    try {
      const { isResendConfigured, sendPasswordResetEmail } = await import("@/lib/email/resend.server");
      if (isResendConfigured()) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: data.email,
          options: { redirectTo },
        });
        if (!error && link?.properties?.action_link) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("username")
            .eq("id", link.user.id)
            .maybeSingle();
          await sendPasswordResetEmail({
            to: data.email,
            nickname: profile?.username ?? "usuário",
            resetUrl: link.properties.action_link,
          });
        }
      } else {
        await publicClient().auth.resetPasswordForEmail(data.email, { redirectTo });
      }
    } catch (err) {
      console.error("[reset] erro ao processar pedido", err instanceof Error ? err.message : "");
    }
    return { message: GENERIC_RESET_MESSAGE };
  });
