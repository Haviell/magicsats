CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  balance NUMERIC DEFAULT 0 NOT NULL,
  in_game_balance NUMERIC DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perfis públicos visíveis por todos" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuário cria o próprio perfil" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuário atualiza o próprio perfil" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.raffles (
  id SERIAL PRIMARY KEY,
  round_number INTEGER NOT NULL,
  total_prize NUMERIC NOT NULL,
  ticket_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public.raffles TO anon, authenticated;
GRANT ALL ON public.raffles TO service_role;
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rifas visíveis" ON public.raffles FOR SELECT USING (true);

CREATE TABLE public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  raffle_id INTEGER REFERENCES public.raffles(id),
  user_id UUID REFERENCES public.profiles(id),
  ticket_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public.tickets TO anon;
GRANT SELECT, INSERT ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bilhetes visíveis" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Usuário compra os próprios bilhetes" ON public.tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.raffle_winners (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER REFERENCES public.raffles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  winning_number INTEGER NOT NULL,
  prize_satoshis NUMERIC NOT NULL,
  has_claimed_next_round_number BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(round_number, winning_number)
);
GRANT SELECT ON public.raffle_winners TO anon, authenticated;
GRANT ALL ON public.raffle_winners TO service_role;
ALTER TABLE public.raffle_winners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vencedores visíveis" ON public.raffle_winners FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', split_part(new.email,'@',1) || '_' || substr(new.id::text,1,4)))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.get_auth_email_by_username(uname TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE found_email TEXT;
BEGIN
  SELECT au.email INTO found_email FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE LOWER(p.username) = LOWER(TRIM(uname)) LIMIT 1;
  RETURN found_email;
END; $$;

CREATE OR REPLACE FUNCTION public.is_round_winner(check_user_id UUID, target_round INTEGER)
RETURNS TABLE (is_winner BOOLEAN, winning_number INTEGER, prize_satoshis NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT true, rw.winning_number, rw.prize_satoshis
  FROM public.raffle_winners rw
  WHERE rw.user_id = check_user_id AND rw.round_number = target_round LIMIT 1;
END; $$;