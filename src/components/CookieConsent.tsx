import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const KEY = "magicsats_cookie_consent";

export function CookieConsent() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(KEY)) setShow(true);
  }, []);
  if (!show) return null;
  const choose = (v: "all" | "essential") => {
    localStorage.setItem(KEY, JSON.stringify({ v, at: new Date().toISOString() }));
    setShow(false);
  };
  return (
    <div role="dialog" aria-label="Aviso de cookies" className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto max-w-3xl rounded-lg border-2 border-border bg-card text-card-foreground p-4 shadow-lg flex flex-col sm:flex-row gap-3 sm:items-center">
        <p className="text-sm flex-1">
          Usamos cookies essenciais para login e funcionamento do site, conforme a LGPD. Cookies opcionais só com seu consentimento.{" "}
          <Link to="/privacidade" className="underline">Política de privacidade</Link>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => choose("essential")}>Só essenciais</Button>
          <Button onClick={() => choose("all")}>Aceitar todos</Button>
        </div>
      </div>
    </div>
  );
}
