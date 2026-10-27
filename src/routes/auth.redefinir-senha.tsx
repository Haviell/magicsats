import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — MagicSats" },
      { name: "description", content: "Crie uma nova senha para sua conta MagicSats." },
      { property: "og:title", content: "Redefinir senha — MagicSats" },
      { property: "og:description", content: "Crie uma nova senha para sua conta MagicSats." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("A senha deve ter no mínimo 8 caracteres.");
    if (password !== confirm) return setError("As senhas digitadas não coincidem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    navigate({ to: "/rifa" });
  };

  return (
    <main className="container mx-auto px-4 pt-16 pb-10">
      <form
        onSubmit={submit}
        className="mx-auto max-w-md space-y-4 rounded-xl border-[4px] border-black bg-white p-6 shadow-[8px_10px_0px_0px_rgba(0,0,0,1)]"
      >
        <h1 className="text-center text-2xl font-bold">Nova senha</h1>
        <input
          type="password"
          placeholder="Nova senha"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border-2 border-black px-3 py-2"
        />
        <input
          type="password"
          placeholder="Confirmar senha"
          minLength={8}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border-2 border-black px-3 py-2"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </main>
  );
}
