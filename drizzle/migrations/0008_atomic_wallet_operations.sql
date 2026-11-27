ALTER TABLE public.raffles ADD COLUMN total_numbers integer NOT NULL DEFAULT 99;
ALTER TABLE public.withdrawals ADD COLUMN idempotency_key uuid;
CREATE UNIQUE INDEX withdrawals_user_request_idx ON public.withdrawals(user_id, idempotency_key);
CREATE INDEX withdrawals_user_created_idx ON public.withdrawals(user_id, created_at DESC);
CREATE INDEX ledger_user_created_idx ON public.ledger_entries(user_id, created_at DESC);
CREATE INDEX tickets_user_raffle_idx ON public.tickets(user_id, raffle_id);
CREATE UNIQUE INDEX IF NOT EXISTS tickets_raffle_number_unique ON public.tickets(raffle_id, ticket_number);
CREATE TABLE public.ticket_purchases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 raffle_id integer NOT NULL REFERENCES public.raffles(id), numbers integer[] NOT NULL,
 amount_sats bigint NOT NULL CHECK(amount_sats > 0), idempotency_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,idempotency_key)
);
GRANT SELECT ON public.ticket_purchases TO authenticated;
GRANT ALL ON public.ticket_purchases TO service_role;
ALTER TABLE public.ticket_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own ticket purchases" ON public.ticket_purchases FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE INDEX ticket_purchases_user_created_idx ON public.ticket_purchases(user_id,created_at DESC);
CREATE INDEX ticket_purchases_raffle_idx ON public.ticket_purchases(raffle_id);

CREATE OR REPLACE FUNCTION public.purchase_raffle_tickets(_user_id uuid,_round_number integer,_numbers integer[],_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.raffles%ROWTYPE; w public.wallets%ROWTYPE; p public.ticket_purchases%ROWTYPE; price_sats numeric; cost bigint; sorted_numbers integer[];
BEGIN
 IF _user_id IS NULL OR _key IS NULL OR _round_number IS NULL OR _round_number<0 OR cardinality(_numbers) IS NULL OR cardinality(_numbers)<1 OR cardinality(_numbers)>99 THEN RAISE EXCEPTION 'invalid_purchase'; END IF;
 SELECT array_agg(n ORDER BY n) INTO sorted_numbers FROM unnest(_numbers) n;
 IF EXISTS(SELECT 1 FROM unnest(_numbers) n WHERE n IS NULL OR n<1 OR n>99) OR (SELECT count(DISTINCT n) FROM unnest(_numbers) n)<>cardinality(_numbers) THEN RAISE EXCEPTION 'invalid_numbers'; END IF;
 SELECT * INTO r FROM public.raffles WHERE round_number=_round_number FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'round_unavailable'; END IF;
 INSERT INTO public.wallets(user_id) VALUES(_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO w FROM public.wallets WHERE user_id=_user_id FOR UPDATE;
 SELECT * INTO p FROM public.ticket_purchases WHERE user_id=_user_id AND idempotency_key=_key;
 IF p.id IS NOT NULL THEN
  IF p.raffle_id<>r.id OR p.numbers<>sorted_numbers THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
  RETURN jsonb_build_object('purchaseId',p.id,'amountSats',p.amount_sats,'numbers',p.numbers,'roundNumber',_round_number);
 END IF;
 IF r.status<>'active' OR r.round_number<>public.current_open_round() OR r.total_numbers<>99 THEN RAISE EXCEPTION 'round_unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.tickets WHERE raffle_id=r.id AND ticket_number=ANY(_numbers)) THEN RAISE EXCEPTION 'number_unavailable'; END IF;
 price_sats:=r.ticket_price*100000000;
 IF price_sats<=0 OR price_sats<>trunc(price_sats) OR price_sats*cardinality(_numbers)>9007199254740991 THEN RAISE EXCEPTION 'invalid_price'; END IF;
 cost:=price_sats*cardinality(_numbers);
 IF w.balance_sats<cost THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
 INSERT INTO public.ticket_purchases(user_id,raffle_id,numbers,amount_sats,idempotency_key) VALUES(_user_id,r.id,sorted_numbers,cost,_key) RETURNING * INTO p;
 UPDATE public.wallets SET balance_sats=balance_sats-cost,updated_at=now() WHERE user_id=_user_id;
 INSERT INTO public.ledger_entries(user_id,entry_type,amount_sats,reference) VALUES(_user_id,'ticket_purchase',-cost,p.id::text);
 INSERT INTO public.tickets(raffle_id,user_id,ticket_number) SELECT r.id,_user_id,n FROM unnest(sorted_numbers) n;
 RETURN jsonb_build_object('purchaseId',p.id,'amountSats',cost,'numbers',sorted_numbers,'roundNumber',_round_number);
END $$;
REVOKE ALL ON FUNCTION public.purchase_raffle_tickets(uuid,integer,integer[],uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_raffle_tickets(uuid,integer,integer[],uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(_user_id uuid,_amount_sats bigint,_destination text,_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w public.wallets%ROWTYPE; p public.withdrawals%ROWTYPE;
BEGIN
 IF _user_id IS NULL OR _key IS NULL OR _amount_sats IS NULL OR _amount_sats<2000 OR _amount_sats>100000000 OR length(_destination)<14 OR length(_destination)>120 THEN RAISE EXCEPTION 'invalid_withdrawal'; END IF;
 INSERT INTO public.wallets(user_id) VALUES(_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO w FROM public.wallets WHERE user_id=_user_id FOR UPDATE;
 SELECT * INTO p FROM public.withdrawals WHERE user_id=_user_id AND idempotency_key=_key;
 IF p.id IS NOT NULL THEN
  IF p.amount_sats<>_amount_sats OR p.destination<>_destination THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
 ELSE
  IF w.balance_sats<_amount_sats THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  INSERT INTO public.withdrawals(user_id,amount_sats,destination,idempotency_key) VALUES(_user_id,_amount_sats,_destination,_key) RETURNING * INTO p;
  UPDATE public.wallets SET balance_sats=balance_sats-_amount_sats,updated_at=now() WHERE user_id=_user_id;
  INSERT INTO public.ledger_entries(user_id,entry_type,amount_sats,reference) VALUES(_user_id,'withdrawal',-_amount_sats,p.id::text);
 END IF;
 RETURN jsonb_build_object('id',p.id,'amountSats',p.amount_sats,'destination',p.destination,'status',p.status,'createdAt',p.created_at);
END $$;
REVOKE ALL ON FUNCTION public.request_wallet_withdrawal(uuid,bigint,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_wallet_withdrawal(uuid,bigint,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_wallet_withdrawal(_user_id uuid,_withdrawal_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.withdrawals%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public.withdrawals WHERE id=_withdrawal_id AND user_id=_user_id FOR UPDATE;
 IF p.id IS NULL THEN RAISE EXCEPTION 'withdrawal_unavailable'; END IF;
 IF p.status='cancelled' THEN RETURN false; END IF;
 IF p.status<>'pending' THEN RAISE EXCEPTION 'withdrawal_not_pending'; END IF;
 UPDATE public.wallets SET balance_sats=balance_sats+p.amount_sats,updated_at=now() WHERE user_id=_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'wallet_unavailable'; END IF;
 INSERT INTO public.ledger_entries(user_id,entry_type,amount_sats,reference) VALUES(_user_id,'adjustment',p.amount_sats,'withdrawal_cancel:'||p.id::text);
 UPDATE public.withdrawals SET status='cancelled' WHERE id=p.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.cancel_wallet_withdrawal(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_wallet_withdrawal(uuid,uuid) TO service_role;