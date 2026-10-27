CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_unsubscribe_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, marketing_opt_in)
  VALUES (
    new.id,
    COALESCE(NULLIF(new.raw_user_meta_data->>'username', ''), 'anon_' || substr(new.id::text, 1, 8)),
    CASE
      WHEN new.raw_user_meta_data->>'marketing_opt_in' IN ('true', 'false')
        THEN (new.raw_user_meta_data->>'marketing_opt_in')::BOOLEAN
      ELSE false
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_open_round()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT MIN(round_number) FROM public.raffles WHERE status = 'active'),
    (SELECT MIN(round_number) FROM public.raffles WHERE status = 'upcoming'),
    (SELECT MAX(round_number) + 1 FROM public.raffles WHERE status = 'completed'),
    1
  )
$$;
REVOKE ALL ON FUNCTION public.current_open_round() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_open_round() TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_round_access(INTEGER);
CREATE FUNCTION public.get_round_access(target_round INTEGER)
RETURNS TABLE (
  can_view BOOLEAN,
  early_access BOOLEAN,
  allowed_number INTEGER,
  open_round INTEGER,
  number_claimed BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  open_r INTEGER := public.current_open_round();
  win_number INTEGER;
  claimed BOOLEAN;
BEGIN
  IF target_round IS NULL OR target_round < 0 THEN
    RETURN QUERY SELECT false, false, NULL::INTEGER, open_r, false;
    RETURN;
  END IF;

  IF target_round <= open_r THEN
    RETURN QUERY SELECT true, false, NULL::INTEGER, open_r, false;
    RETURN;
  END IF;

  IF target_round = open_r + 1 AND auth.uid() IS NOT NULL THEN
    SELECT rw.winning_number, COALESCE(rw.has_claimed_next_round_number, false)
    INTO win_number, claimed
    FROM public.raffle_winners rw
    WHERE rw.user_id = auth.uid() AND rw.round_number = open_r
    LIMIT 1;

    IF win_number IS NOT NULL THEN
      RETURN QUERY SELECT true, true, win_number, open_r, claimed;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT false, false, NULL::INTEGER, open_r, false;
END;
$$;
REVOKE ALL ON FUNCTION public.get_round_access(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_round_access(INTEGER) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_winner_number(target_round INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  winner_row public.raffle_winners%ROWTYPE;
  next_raffle_id INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para continuar.';
  END IF;

  IF target_round <> public.current_open_round() + 1 THEN
    RAISE EXCEPTION 'A reserva antecipada está disponível somente para a próxima rodada.';
  END IF;

  SELECT *
  INTO winner_row
  FROM public.raffle_winners
  WHERE user_id = auth.uid() AND round_number = target_round - 1
  LIMIT 1
  FOR UPDATE;

  IF winner_row.id IS NULL THEN
    RAISE EXCEPTION 'Apenas o vencedor da rodada anterior pode reservar este número.';
  END IF;

  IF COALESCE(winner_row.has_claimed_next_round_number, false) THEN
    RAISE EXCEPTION 'O número vencedor já foi reservado para esta rodada.';
  END IF;

  SELECT id INTO next_raffle_id
  FROM public.raffles
  WHERE round_number = target_round
  LIMIT 1;

  IF next_raffle_id IS NULL THEN
    INSERT INTO public.raffles (round_number, total_prize, ticket_price, status)
    VALUES (target_round, 0.0008, 0.00001, 'upcoming')
    ON CONFLICT (round_number) DO UPDATE SET round_number = EXCLUDED.round_number
    RETURNING id INTO next_raffle_id;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.raffles
    WHERE id = next_raffle_id AND status = 'upcoming'
  ) THEN
    RAISE EXCEPTION 'A próxima rodada não está disponível para reserva antecipada.';
  END IF;

  INSERT INTO public.tickets (raffle_id, user_id, ticket_number)
  VALUES (next_raffle_id, auth.uid(), winner_row.winning_number);

  UPDATE public.raffle_winners
  SET has_claimed_next_round_number = true
  WHERE id = winner_row.id;

  RETURN winner_row.winning_number;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_winner_number(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_winner_number(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_sold_numbers(target_round INTEGER)
RETURNS SETOF INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  access_granted BOOLEAN;
BEGIN
  SELECT round_access.can_view
  INTO access_granted
  FROM public.get_round_access(target_round) AS round_access;

  IF NOT COALESCE(access_granted, false) THEN
    RAISE EXCEPTION 'Esta rodada ainda não está disponível para sua conta.';
  END IF;

  RETURN QUERY
  SELECT t.ticket_number
  FROM public.tickets t
  JOIN public.raffles r ON r.id = t.raffle_id
  WHERE r.round_number = target_round
  ORDER BY t.ticket_number;
END;
$$;
REVOKE ALL ON FUNCTION public.get_sold_numbers(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sold_numbers(INTEGER) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_winning_numbers()
RETURNS TABLE (
  round_number INTEGER,
  winning_number INTEGER,
  prize_satoshis NUMERIC,
  has_claimed_next_round_number BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    rw.round_number,
    rw.winning_number,
    rw.prize_satoshis,
    COALESCE(rw.has_claimed_next_round_number, false)
  FROM public.raffle_winners rw
  WHERE auth.uid() IS NOT NULL AND rw.user_id = auth.uid()
  ORDER BY rw.round_number DESC
$$;
REVOKE ALL ON FUNCTION public.get_my_winning_numbers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_winning_numbers() TO authenticated;

DROP POLICY IF EXISTS "Rifas visíveis" ON public.raffles;
CREATE POLICY "Rodadas acessíveis visíveis" ON public.raffles
FOR SELECT TO anon, authenticated
USING (
  status IN ('active', 'completed')
  OR (
    status = 'upcoming'
    AND (
      public.raffles.round_number = public.current_open_round()
      OR (
        auth.uid() IS NOT NULL
        AND public.raffles.round_number = public.current_open_round() + 1
        AND EXISTS (
          SELECT 1
          FROM public.raffle_winners rw
          WHERE rw.user_id = auth.uid()
            AND rw.round_number = public.current_open_round()
        )
      )
    )
  )
);

CREATE OR REPLACE FUNCTION public.get_public_winners()
RETURNS TABLE (
  round_number INTEGER,
  winning_number INTEGER,
  prize_satoshis NUMERIC,
  nickname_masked TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    rw.round_number,
    rw.winning_number,
    rw.prize_satoshis,
    LEFT(COALESCE(p.username, 'anon'), 2) || '***'
  FROM public.raffle_winners rw
  LEFT JOIN public.profiles p ON p.id = rw.user_id
  WHERE rw.round_number <= public.current_open_round()
  ORDER BY rw.round_number DESC
$$;
REVOKE ALL ON FUNCTION public.get_public_winners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_winners() TO anon, authenticated;
