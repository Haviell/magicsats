DROP POLICY IF EXISTS "Perfis públicos visíveis por todos" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;
CREATE POLICY "Usuário vê o próprio perfil" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS transactional_opt_in BOOLEAN NOT NULL DEFAULT true;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (username, marketing_opt_in, transactional_opt_in) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Bilhetes visíveis" ON public.tickets;
REVOKE SELECT ON public.tickets FROM anon;
CREATE POLICY "Usuário vê os próprios bilhetes" ON public.tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Vencedores visíveis" ON public.raffle_winners;
REVOKE SELECT ON public.raffle_winners FROM anon;
CREATE POLICY "Vencedor vê a própria vitória" ON public.raffle_winners FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP FUNCTION IF EXISTS public.get_auth_email_by_username(TEXT);
DROP FUNCTION IF EXISTS public.is_round_winner(UUID, INTEGER);

CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê os próprios papéis" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

ALTER TABLE public.raffles DROP CONSTRAINT IF EXISTS raffles_status_check;
ALTER TABLE public.raffles ADD CONSTRAINT raffles_status_check CHECK (status IN ('upcoming','active','completed'));
ALTER TABLE public.raffles ADD CONSTRAINT raffles_round_unique UNIQUE (round_number);

CREATE OR REPLACE FUNCTION public.is_username_available(uname TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(TRIM(uname)))
$$;
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_open_round()
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT MIN(round_number) FROM public.raffles WHERE status = 'active'),
    (SELECT MAX(round_number) + 1 FROM public.raffles WHERE status = 'completed'),
    1)
$$;
GRANT EXECUTE ON FUNCTION public.current_open_round() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_round_access(target_round INTEGER)
RETURNS TABLE (can_view BOOLEAN, early_access BOOLEAN, allowed_number INTEGER, open_round INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  open_r INTEGER := public.current_open_round();
  win_number INTEGER;
BEGIN
  IF target_round <= open_r THEN
    RETURN QUERY SELECT true, false, NULL::INTEGER, open_r; RETURN;
  END IF;
  IF target_round = open_r + 1 AND auth.uid() IS NOT NULL THEN
    SELECT rw.winning_number INTO win_number FROM public.raffle_winners rw
    WHERE rw.user_id = auth.uid() AND rw.round_number = open_r LIMIT 1;
    IF win_number IS NOT NULL THEN
      RETURN QUERY SELECT true, true, win_number, open_r; RETURN;
    END IF;
  END IF;
  RETURN QUERY SELECT false, false, NULL::INTEGER, open_r;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_round_access(INTEGER) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_winner_number(target_round INTEGER)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w RECORD;
  next_raffle_id INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para continuar.'; END IF;
  SELECT * INTO w FROM public.raffle_winners
  WHERE user_id = auth.uid() AND round_number = target_round - 1 LIMIT 1 FOR UPDATE;
  IF w IS NULL THEN RAISE EXCEPTION 'Apenas o vencedor da rodada anterior pode fazer isso.'; END IF;
  IF w.has_claimed_next_round_number THEN RAISE EXCEPTION 'Você já garantiu seu número nesta rodada.'; END IF;
  SELECT id INTO next_raffle_id FROM public.raffles WHERE round_number = target_round;
  IF next_raffle_id IS NULL THEN
    INSERT INTO public.raffles (round_number, total_prize, ticket_price, status)
    VALUES (target_round, 0.0008, 0.00001, 'upcoming') RETURNING id INTO next_raffle_id;
  END IF;
  INSERT INTO public.tickets (raffle_id, user_id, ticket_number) VALUES (next_raffle_id, auth.uid(), w.winning_number);
  UPDATE public.raffle_winners SET has_claimed_next_round_number = true WHERE id = w.id;
  RETURN w.winning_number;
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_winner_number(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_winner_number(INTEGER) TO authenticated;

DROP POLICY IF EXISTS "Usuário compra os próprios bilhetes" ON public.tickets;
CREATE POLICY "Usuário compra bilhetes em rodada aberta" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.raffles r WHERE r.id = raffle_id AND r.status = 'active'));
CREATE UNIQUE INDEX IF NOT EXISTS tickets_raffle_number_unique ON public.tickets (raffle_id, ticket_number);

CREATE OR REPLACE FUNCTION public.get_sold_numbers(target_round INTEGER)
RETURNS SETOF INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.ticket_number FROM public.tickets t JOIN public.raffles r ON r.id = t.raffle_id
  WHERE r.round_number = target_round
$$;
GRANT EXECUTE ON FUNCTION public.get_sold_numbers(INTEGER) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_winners()
RETURNS TABLE (round_number INTEGER, winning_number INTEGER, prize_satoshis NUMERIC, nickname_masked TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rw.round_number, rw.winning_number, rw.prize_satoshis, LEFT(p.username, 2) || '***'
  FROM public.raffle_winners rw LEFT JOIN public.profiles p ON p.id = rw.user_id
  ORDER BY rw.round_number DESC
$$;
GRANT EXECUTE ON FUNCTION public.get_public_winners() TO anon, authenticated;

INSERT INTO public.raffles (round_number, total_prize, ticket_price, status)
VALUES (0, 0.00044, 0.00001, 'completed'), (1, 0.0008, 0.00001, 'active')
ON CONFLICT (round_number) DO NOTHING;