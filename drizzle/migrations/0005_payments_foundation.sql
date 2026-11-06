CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY,
  balance_sats bigint NOT NULL DEFAULT 0 CHECK (balance_sats >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_sats bigint NOT NULL CHECK (amount_sats > 0),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','waiting_payment','processing','confirmed','completed','expired','failed','partial','overpaid')),
  provider text NOT NULL DEFAULT 'mock',
  provider_checkout_id text UNIQUE,
  checkout_url text,
  idempotency_key text NOT NULL,
  expires_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE TABLE public.payment_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  deposit_id uuid REFERENCES public.deposits(id),
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_event_id)
);
CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('deposit','withdrawal','ticket_purchase','prize','adjustment')),
  amount_sats bigint NOT NULL,
  reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_type, reference)
);
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_sats bigint NOT NULL CHECK (amount_sats > 0),
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','in_progress','completed','cancelled','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallets, public.deposits, public.ledger_entries, public.withdrawals TO authenticated;
GRANT ALL ON public.wallets, public.deposits, public.payment_provider_events, public.ledger_entries, public.withdrawals TO service_role;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own wallet" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own deposits" ON public.deposits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own ledger" ON public.ledger_entries FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Idempotent credit: only service_role may call; credits once per deposit.
CREATE OR REPLACE FUNCTION public.credit_confirmed_deposit(_deposit_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE d public.deposits%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF d.id IS NULL OR d.credited_at IS NOT NULL THEN RETURN false; END IF;
  INSERT INTO public.ledger_entries (user_id, entry_type, amount_sats, reference)
  VALUES (d.user_id, 'deposit', d.amount_sats, d.id::text) ON CONFLICT DO NOTHING;
  INSERT INTO public.wallets (user_id, balance_sats) VALUES (d.user_id, d.amount_sats)
  ON CONFLICT (user_id) DO UPDATE SET balance_sats = public.wallets.balance_sats + EXCLUDED.balance_sats, updated_at = now();
  UPDATE public.deposits SET status = 'completed', credited_at = now(), updated_at = now() WHERE id = d.id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.credit_confirmed_deposit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_confirmed_deposit(uuid) TO service_role;