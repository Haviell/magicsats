DROP POLICY IF EXISTS "Usuário compra bilhetes em rodada aberta" ON public.tickets;
REVOKE INSERT ON public.tickets FROM authenticated, anon;