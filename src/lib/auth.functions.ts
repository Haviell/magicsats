import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";

const GENERIC_LOGIN_ERROR = "E-mail/Nickname ou senha incorretos.";
const GENERIC_RESET_MESSAGE = "Se este e-mail estiver cadastrado, as instruções foram enviadas.";
const GENERIC_SIGNUP_ERROR = "Não foi possível criar a conta com esses dados.";

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

function getTrustedOrigin(requestedOrigin: string) {
  const request = getRequest();
  const requestOrigin = new URL(request.url).origin;
  const browserOrigin = request.headers.get("origin");

  if (
    requestedOrigin !== requestOrigin ||
    (browserOrigin && browserOrigin !== requestOrigin)
  ) {
    throw new Error("Origem inválida.");
  }

  return requestOrigin;
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
        .ilike("username", nick.replace(/[\\%_]/g, "\\$&"))
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

/** Create an account and send its confirmation through Resend when configured. */
export const registerWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      nickname: string;
      email: string;
      password: string;
      marketingOptIn?: boolean;
      origin: string;
    }) => {
      const nickname = String(input?.nickname ?? "").trim().replace(/^@/, "");
      const email = String(input?.email ?? "").trim().toLowerCase();
      const password = String(input?.password ?? "");
      const marketingOptIn = input?.marketingOptIn === true;
      const origin = String(input?.origin ?? "");

      if (!/^[a-zA-Z0-9_.]{3,20}$/.test(nickname)) {
        throw new Error("O nickname deve ter de 3 a 20 caracteres (letras, números, _ ou .).");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        throw new Error("Informe um e-mail válido.");
      }
      if (password.length < 8 || password.length > 200) {
        throw new Error("A senha deve ter entre 8 e 200 caracteres.");
      }
      if (!/^https?:\/\/[^/]+$/.test(origin)) {
        throw new Error("Origem inválida.");
      }

      return { nickname, email, password, marketingOptIn, origin };
    },
  )
  .handler(async ({ data }) => {
    const origin = getTrustedOrigin(data.origin);
    const redirectTo = `${origin}/rifa`;
    const { data: available, error: availabilityError } = await publicClient().rpc(
      "is_username_available",
      { uname: data.nickname },
    );

    if (availabilityError) {
      throw new Error("Não foi possível verificar o nickname. Tente novamente.");
    }
    if (!available) {
      throw new Error("Este nickname já está em uso. Por favor, escolha outro.");
    }

    const metadata = {
      username: data.nickname,
      marketing_opt_in: data.marketingOptIn,
    };

    const { isResendConfigured, sendSignupConfirmationEmail } = await import(
      "@/lib/email/resend.server"
    );

    if (isResendConfigured()) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email: data.email,
        password: data.password,
        options: { data: metadata, redirectTo },
      });

      if (error || !link?.properties?.action_link) {
        throw new Error(GENERIC_SIGNUP_ERROR);
      }

      let delivered = false;
      try {
        const result = await sendSignupConfirmationEmail({
          to: data.email,
          nickname: data.nickname,
          confirmUrl: link.properties.action_link,
        });
        delivered = result.success;
      } catch {
        console.error("[auth] signup confirmation delivery failed");
      }

      if (!delivered) {
        const { error: resendError } = await publicClient().auth.resend({
          type: "signup",
          email: data.email,
          options: { emailRedirectTo: redirectTo },
        });
        if (resendError) {
          console.error("[auth] fallback confirmation delivery failed");
          throw new Error("Conta criada, mas não foi possível enviar a confirmação. Tente solicitar um novo e-mail.");
        }
      }

      return { access_token: null, refresh_token: null, needsConfirmation: true };
    }

    const { data: signup, error } = await publicClient().auth.signUp({
      email: data.email,
      password: data.password,
      options: { emailRedirectTo: redirectTo, data: metadata },
    });

    if (error) {
      throw new Error(
        error.message.toLowerCase().includes("username")
          ? "Este nickname já está em uso. Por favor, escolha outro."
          : GENERIC_SIGNUP_ERROR,
      );
    }

    return {
      access_token: signup.session?.access_token ?? null,
      refresh_token: signup.session?.refresh_token ?? null,
      needsConfirmation: !signup.session,
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
    const origin = getTrustedOrigin(data.origin);
    const redirectTo = `${origin}/auth/redefinir-senha`;
    try {
      const { isResendConfigured, sendPasswordResetEmail } = await import("@/lib/email/resend.server");
      let delivered = false;
      if (isResendConfigured()) {
        try {
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
            const result = await sendPasswordResetEmail({
              to: data.email,
              nickname: profile?.username ?? "usuário",
              resetUrl: link.properties.action_link,
            });
            delivered = result.success;
          }
        } catch {
          console.error("[auth] Resend password reset delivery failed");
        }
      }

      if (!delivered) {
        const { error } = await publicClient().auth.resetPasswordForEmail(data.email, { redirectTo });
        if (error) throw error;
      }
    } catch {
      console.error("[auth] password reset delivery failed");
    }
    return { message: GENERIC_RESET_MESSAGE };
  });
