import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RoundAccess = {
  canView: boolean;
  earlyAccess: boolean;
  allowedNumber: number | null;
  openRound: number;
  numberClaimed: boolean;
};

function firstRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getRoundAccess(targetRound: number): Promise<RoundAccess> {
  if (!Number.isInteger(targetRound) || targetRound < 0) {
    throw new Error("Rodada inválida.");
  }

  const { data, error } = await supabase.rpc("get_round_access", {
    target_round: targetRound,
  });
  if (error) {
    throw new Error("Não foi possível verificar o acesso a esta rodada.");
  }

  const access = firstRow(data);
  if (!access) {
    throw new Error("O servidor não retornou as permissões desta rodada.");
  }

  return {
    canView: access.can_view,
    earlyAccess: access.early_access,
    allowedNumber: access.allowed_number,
    openRound: access.open_round,
    numberClaimed: access.number_claimed,
  };
}

export function useRoundAccess() {
  const [openRound, setOpenRound] = useState<number | null>(null);
  const [nextRoundAccess, setNextRoundAccess] = useState<RoundAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const { data, error: roundError } = await supabase.rpc("current_open_round");
      if (roundError || !Number.isInteger(data) || data < 0) {
        throw new Error("Não foi possível carregar a rodada atual.");
      }

      const access = await getRoundAccess(data + 1);
      setOpenRound(data);
      setNextRoundAccess(access);
      return { openRound: data, nextRoundAccess: access };
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Não foi possível verificar as rifas disponíveis.";
      setError(message);
      setOpenRound(null);
      setNextRoundAccess(null);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => {
      void refresh().catch(() => {
        if (!active) return;
      });
    };

    load();
    const interval = window.setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(load, 0);
    });

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      subscription.unsubscribe();
    };
  }, [refresh]);

  return {
    openRound,
    nextRoundAccess,
    loading,
    error,
    refresh,
    getAccess: getRoundAccess,
  };
}
