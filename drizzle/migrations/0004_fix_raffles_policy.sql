CREATE OR REPLACE FUNCTION public.is_current_round_winner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.raffle_winners rw WHERE rw.user_id = auth.uid() AND rw.round_number = public.current_open_round())
$$;
GRANT EXECUTE ON FUNCTION public.is_current_round_winner() TO anon, authenticated;
DROP POLICY IF EXISTS "Rodadas acessíveis visíveis" ON public.raffles;
CREATE POLICY "Rodadas acessíveis visíveis" ON public.raffles FOR SELECT TO anon, authenticated
USING (status IN ('active','completed') OR (status = 'upcoming' AND (round_number = public.current_open_round() OR (round_number = public.current_open_round() + 1 AND public.is_current_round_winner()))));