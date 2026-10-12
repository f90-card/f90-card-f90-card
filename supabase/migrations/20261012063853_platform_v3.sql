-- F90 CARD v3. Additive platform migration; existing catalog and auth users remain.
BEGIN;
CREATE SEQUENCE IF NOT EXISTS public.f90_customer_number START 100001;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS customer_id text UNIQUE DEFAULT ('F90-' || nextval('public.f90_customer_number')),
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS phone_country text DEFAULT '+970',
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','suspended','banned')),
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_override smallint CHECK (vip_override BETWEEN 1 AND 7),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS f90_categories_parent ON public.categories(parent_id,sort_order);
CREATE INDEX IF NOT EXISTS f90_products_category_sort ON public.products(category_id,sort_order);
CREATE INDEX IF NOT EXISTS f90_profiles_email ON public.profiles(lower(email));

CREATE TABLE public.f90_user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','manager','admin','designer','trader','support')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.f90_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  balance_usd numeric(20,6) NOT NULL DEFAULT 0 CHECK(balance_usd >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.f90_rates (
  currency text PRIMARY KEY CHECK(currency ~ '^[A-Z]{3,8}$'),
  name_ar text NOT NULL,
  per_usd numeric(20,8) CHECK(per_usd > 0),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(currency <> 'USD' OR per_usd = 1)
);
INSERT INTO public.f90_rates(currency,name_ar,per_usd,is_enabled) VALUES
  ('USD','دولار أمريكي',1,true),('ILS','شيكل',NULL,false),('JOD','دينار أردني',NULL,false);
CREATE TABLE public.f90_vip_tiers (
  level smallint PRIMARY KEY CHECK(level BETWEEN 1 AND 7),
  minimum_spend numeric(20,6) NOT NULL CHECK(minimum_spend >= 0),
  discount_percent numeric(8,5) NOT NULL CHECK(discount_percent BETWEEN 0 AND 2)
);
INSERT INTO public.f90_vip_tiers VALUES (1,0,0),(2,50,0.001),(3,200,0.1),(4,500,0.25),(5,1000,0.5),(6,2500,1),(7,5000,2);
CREATE TABLE public.f90_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,
  endpoint text NOT NULL CHECK(endpoint ~ '^https://'),
  adapter text NOT NULL DEFAULT 'smm' CHECK(adapter IN ('smm','json')),
  currency text NOT NULL DEFAULT 'USD' REFERENCES public.f90_rates(currency),
  secret_id uuid, is_enabled boolean NOT NULL DEFAULT false,
  margin_percent numeric(12,4) NOT NULL DEFAULT 20 CHECK(margin_percent >= 0),
  config jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.f90_product_internal (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.f90_providers(id) ON DELETE RESTRICT,
  provider_service text,cost_usd numeric(20,6) CHECK(cost_usd >= 0),
  trader_price_usd numeric(20,6) CHECK(trader_price_usd > 0),
  auto_margin boolean NOT NULL DEFAULT false
);
CREATE INDEX f90_internal_provider ON public.f90_product_internal(provider_id);
CREATE TABLE public.f90_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL, product_image text, quantity bigint NOT NULL CHECK(quantity > 0),
  unit_quantity bigint NOT NULL CHECK(unit_quantity > 0),
  subtotal_usd numeric(20,6) NOT NULL CHECK(subtotal_usd > 0),
  discount_usd numeric(20,6) NOT NULL DEFAULT 0 CHECK(discount_usd >= 0),
  total_usd numeric(20,6) NOT NULL CHECK(total_usd > 0),
  refunded_usd numeric(20,6) NOT NULL DEFAULT 0 CHECK(refunded_usd >= 0 AND refunded_usd <= total_usd),
  cost_usd numeric(20,6), vip_level smallint NOT NULL DEFAULT 1,coupon_code text,
  customer_fields jsonb NOT NULL DEFAULT '{}',
  fulfillment text NOT NULL CHECK(fulfillment IN ('manual','automatic')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','queued','submitting','processing','completed','partial','failed','review','refunded')),
  provider_id uuid REFERENCES public.f90_providers(id) ON DELETE RESTRICT,
  provider_service text,provider_order_id text,provider_status text,
  dispatch_attempts integer NOT NULL DEFAULT 0,
  next_sync_at timestamptz NOT NULL DEFAULT now(),expected_minutes integer CHECK(expected_minutes >= 0),
  idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 160),
  created_at timestamptz NOT NULL DEFAULT now(),started_at timestamptz,completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),stock_reserved boolean NOT NULL DEFAULT false,
  UNIQUE(user_id,idempotency_key)
);
CREATE INDEX f90_orders_user_date ON public.f90_orders(user_id,created_at DESC);
CREATE INDEX f90_orders_month ON public.f90_orders(created_at,status);
CREATE INDEX f90_orders_provider ON public.f90_orders(provider_id);
CREATE INDEX f90_orders_work ON public.f90_orders(next_sync_at) WHERE fulfillment='automatic' AND status IN ('queued','processing');
CREATE INDEX f90_orders_product ON public.f90_orders(product_id);
CREATE TABLE public.f90_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  method_id text NOT NULL,method_name text NOT NULL,method_snapshot jsonb NOT NULL,
  currency text NOT NULL REFERENCES public.f90_rates(currency),amount numeric(20,6) NOT NULL CHECK(amount > 0),
  rate_snapshot numeric(20,8) NOT NULL CHECK(rate_snapshot > 0),
  usd_amount numeric(20,6) NOT NULL CHECK(usd_amount > 0),receipt_path text NOT NULL UNIQUE,
  reference text, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  review_note text,reviewed_by uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,
  idempotency_key text NOT NULL,UNIQUE(user_id,idempotency_key)
);
CREATE INDEX f90_deposits_user_date ON public.f90_deposits(user_id,created_at DESC);
CREATE INDEX f90_deposits_pending ON public.f90_deposits(created_at) WHERE status='pending';
CREATE INDEX f90_deposits_reviewer ON public.f90_deposits(reviewed_by);
CREATE TABLE public.f90_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount_usd numeric(20,6) NOT NULL CHECK(amount_usd <> 0),balance_after numeric(20,6) NOT NULL CHECK(balance_after >= 0),
  kind text NOT NULL CHECK(kind IN ('deposit','purchase','refund','adjustment')),
  reference_id uuid,description text NOT NULL,unique_key text NOT NULL UNIQUE,actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX f90_ledger_user_date ON public.f90_wallet_ledger(user_id,created_at DESC);
CREATE INDEX f90_ledger_actor ON public.f90_wallet_ledger(actor_id);
CREATE TABLE public.f90_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  document_type text NOT NULL CHECK(document_type IN ('id','passport')),
  front_path text NOT NULL,back_path text,selfie_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  review_note text,reviewed_by uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz
);
CREATE UNIQUE INDEX f90_one_pending_verification ON public.f90_verifications(user_id) WHERE status='pending';
CREATE INDEX f90_verification_reviewer ON public.f90_verifications(reviewed_by);
CREATE TABLE public.f90_order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,order_id uuid NOT NULL REFERENCES public.f90_orders(id),
  status text NOT NULL,note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX f90_events_order ON public.f90_order_events(order_id,created_at);
CREATE TABLE public.f90_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,target_id text,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX f90_audit_actor ON public.f90_audit(actor_id,created_at DESC);
CREATE TABLE public.f90_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name text NOT NULL,token_hash text NOT NULL UNIQUE,token_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['catalog','balance','orders'],
  is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz,
  last_used_at timestamptz,requests_per_minute integer NOT NULL DEFAULT 60 CHECK(requests_per_minute BETWEEN 1 AND 300)
);
CREATE INDEX f90_keys_user ON public.f90_api_keys(user_id);
CREATE TABLE public.f90_rate_limits (
  key text PRIMARY KEY,window_start timestamptz NOT NULL,hits integer NOT NULL
);

INSERT INTO public.profiles(id,display_name,email,avatar_url,phone,phone_country)
 SELECT u.id,coalesce(u.raw_user_meta_data->>'display_name',u.raw_user_meta_data->>'full_name','عميل'),u.email,
 u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'phone',coalesce(u.raw_user_meta_data->>'phone_country','+970') FROM auth.users u
 ON CONFLICT(id) DO UPDATE SET email=excluded.email;
INSERT INTO public.f90_user_roles(user_id,role) SELECT u.id,CASE WHEN r.role='admin' THEN 'manager' ELSE 'customer' END
 FROM auth.users u LEFT JOIN public.user_roles r ON r.user_id=u.id ON CONFLICT DO NOTHING;
INSERT INTO public.f90_wallets(user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION f90_private.on_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.profiles(id,display_name,email,avatar_url,phone,phone_country)
  VALUES(NEW.id,left(coalesce(NEW.raw_user_meta_data->>'display_name',NEW.raw_user_meta_data->>'full_name','عميل'),100),NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',left(NEW.raw_user_meta_data->>'phone',25),left(coalesce(NEW.raw_user_meta_data->>'phone_country','+970'),8))
  ON CONFLICT(id) DO UPDATE SET email=excluded.email;
  INSERT INTO public.f90_user_roles(user_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.f90_wallets(user_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION f90_private.on_auth_user() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER f90_auth_created AFTER INSERT OR UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION f90_private.on_auth_user();

CREATE OR REPLACE FUNCTION f90_private.my_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.role FROM public.f90_user_roles r JOIN public.profiles p ON p.id=r.user_id
 WHERE r.user_id=(SELECT auth.uid()) AND p.account_status='active'; $$;
REVOKE ALL ON FUNCTION f90_private.my_role() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION f90_private.my_role() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION f90_private.catalog_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.f90_user_roles r JOIN public.profiles p ON p.id=r.user_id
 WHERE r.user_id=(SELECT auth.uid()) AND r.role='manager' AND p.account_status='active'); $$;

CREATE OR REPLACE FUNCTION f90_private.require_actor(p_actor uuid,p_roles text[] DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r text;
BEGIN
 SELECT ur.role INTO r FROM public.f90_user_roles ur JOIN public.profiles p ON p.id=ur.user_id
 WHERE ur.user_id=p_actor AND p.account_status='active';
 IF r IS NULL OR (p_roles IS NOT NULL AND NOT(r=ANY(p_roles))) THEN RAISE EXCEPTION 'F90_FORBIDDEN'; END IF;
 RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION f90_private.category_acyclic() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.parent_id=NEW.id OR EXISTS(WITH RECURSIVE parents AS (
 SELECT id,parent_id FROM public.categories WHERE id=NEW.parent_id UNION
 SELECT c.id,c.parent_id FROM public.categories c JOIN parents p ON c.id=p.parent_id
 ) SELECT 1 FROM parents WHERE id=NEW.id) THEN RAISE EXCEPTION 'F90_CATEGORY_CYCLE'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER f90_category_tree BEFORE INSERT OR UPDATE OF parent_id ON public.categories FOR EACH ROW EXECUTE FUNCTION f90_private.category_acyclic();

-- The legacy broad profile writes cannot grant verification, VIP or status privileges.
REVOKE INSERT,UPDATE,DELETE ON public.profiles,public.user_roles FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.categories,public.products,public.banners,public.site_settings FROM anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['f90_user_roles','f90_wallets','f90_rates','f90_vip_tiers','f90_providers','f90_product_internal','f90_orders','f90_deposits','f90_wallet_ledger','f90_verifications','f90_order_events','f90_audit','f90_api_keys','f90_rate_limits'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
GRANT ALL ON public.profiles,public.categories,public.products,public.banners,public.site_settings TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON public.f90_rates,public.f90_vip_tiers TO anon,authenticated;
CREATE POLICY f90_rates_read ON public.f90_rates FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY f90_vip_read ON public.f90_vip_tiers FOR SELECT TO anon,authenticated USING(true);
GRANT SELECT ON public.f90_user_roles,public.f90_wallets,public.f90_orders,public.f90_deposits,public.f90_wallet_ledger,public.f90_verifications,public.f90_order_events TO authenticated;
CREATE POLICY f90_roles_read ON public.f90_user_roles FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT f90_private.my_role())='manager');
CREATE POLICY f90_wallet_read ON public.f90_wallets FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND (SELECT f90_private.my_role()) IS NOT NULL);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['f90_orders','f90_deposits','f90_wallet_ledger','f90_verifications'] LOOP
 EXECUTE format('CREATE POLICY f90_owner_read ON public.%I FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND (SELECT f90_private.my_role()) IS NOT NULL)',t);
 END LOOP;
END $$;
CREATE POLICY f90_events_read ON public.f90_order_events FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.f90_orders o WHERE o.id=order_id AND o.user_id=(SELECT auth.uid())
));

-- Secrets live in Vault. Public RPCs are invoker functions callable ONLY by the server role.
CREATE OR REPLACE FUNCTION public.f90_provider_secret(p_actor uuid,p_provider uuid,p_secret text DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s uuid; value text;
BEGIN
 IF p_secret IS NOT NULL THEN
  PERFORM f90_private.require_actor(p_actor,ARRAY['manager']);
  SELECT secret_id INTO s FROM public.f90_providers WHERE id=p_provider FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
  IF s IS NULL THEN SELECT vault.create_secret(p_secret,'f90-provider-'||p_provider,'F90 provider credential') INTO s;
  ELSE PERFORM vault.update_secret(s,p_secret); END IF;
  UPDATE public.f90_providers SET secret_id=s WHERE id=p_provider;
  RETURN 'saved';
 END IF;
 SELECT v.decrypted_secret INTO value FROM public.f90_providers p JOIN vault.decrypted_secrets v ON v.id=p.secret_id WHERE p.id=p_provider AND p.is_enabled;
 RETURN value;
END; $$;
CREATE OR REPLACE FUNCTION public.f90_session_valid(p_user uuid,p_session uuid) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=p_session AND s.user_id=p_user AND (s.not_after IS NULL OR s.not_after>now())); $$;

CREATE OR REPLACE FUNCTION public.f90_quote(p_user uuid,p_product uuid,p_quantity bigint DEFAULT 1,p_coupon text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.products%ROWTYPE; c jsonb; v smallint:=1; r text; spent numeric:=0; unit bigint; qty bigint; minq bigint; maxq bigint; stepq bigint;
 rate numeric; price numeric; subtotal numeric; discount numeric:=0; pct numeric:=0; vip_pct numeric:=0; cp jsonb; tier jsonb; cost numeric; trader_price numeric; cfg jsonb; co text:=NULL;
BEGIN
 SELECT * INTO p FROM public.products WHERE id=p_product AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
 c:=p.commerce;
 IF coalesce(c->>'availability','available')='refilling' OR p.stock=0 THEN RAISE EXCEPTION 'F90_REFILLING'; END IF;
 IF EXISTS(WITH RECURSIVE parents AS (SELECT id,parent_id,is_active,presentation FROM public.categories WHERE id=p.category_id UNION SELECT a.id,a.parent_id,a.is_active,a.presentation FROM public.categories a JOIN parents b ON a.id=b.parent_id) SELECT 1 FROM parents WHERE NOT is_active OR presentation->>'availability'='refilling') THEN RAISE EXCEPTION 'F90_REFILLING'; END IF;
 IF p_user IS NOT NULL THEN
  r:=f90_private.require_actor(p_user);
  SELECT coalesce(sum(total_usd-refunded_usd),0) INTO spent FROM public.f90_orders WHERE user_id=p_user AND status IN ('completed','partial');
  SELECT level INTO v FROM public.f90_vip_tiers WHERE minimum_spend<=spent ORDER BY level DESC LIMIT 1;
  SELECT coalesce(vip_override,v,1) INTO v FROM public.profiles WHERE id=p_user;
  SELECT discount_percent INTO vip_pct FROM public.f90_vip_tiers WHERE level=v;
 END IF;
 unit:=greatest(coalesce((c->>'unit_quantity')::bigint,1),1);
 IF coalesce(c->>'type','fixed')='quantity' THEN
  minq:=greatest(coalesce((c->>'quantity_min')::bigint,1),1); maxq:=least(coalesce((c->>'quantity_max')::bigint,1000000000),1000000000); stepq:=greatest(coalesce((c->>'quantity_step')::bigint,1),1);qty:=p_quantity;
  IF qty<minq OR qty>maxq OR mod(qty-minq,stepq)<>0 THEN RAISE EXCEPTION 'F90_QUANTITY'; END IF;
 ELSE qty:=greatest(coalesce((c->>'pack_quantity')::bigint,1),1); END IF;
 price:=nullif(c#>>'{prices,USD}','')::numeric;
 IF price IS NULL THEN
  IF p.currency='USD' THEN price:=p.price; ELSE
  SELECT per_usd INTO rate FROM public.f90_rates WHERE currency=p.currency AND is_enabled;
  IF rate IS NULL THEN RAISE EXCEPTION 'F90_RATE_MISSING'; END IF;price:=p.price/rate;END IF;
 END IF;
 FOR tier IN SELECT value FROM jsonb_array_elements(coalesce(c->'pricing_tiers','[]')) ORDER BY (value->>'min')::numeric LOOP
  IF qty>=coalesce((tier->>'min')::bigint,0) AND nullif(tier#>>'{prices,USD}','') IS NOT NULL THEN price:=(tier#>>'{prices,USD}')::numeric; END IF;
 END LOOP;
 SELECT i.cost_usd,i.trader_price_usd INTO cost,trader_price FROM public.f90_product_internal i WHERE product_id=p.id;
 IF r='trader' AND trader_price IS NOT NULL THEN price:=trader_price;vip_pct:=0; END IF;
 subtotal:=round(price*CASE WHEN c->>'type'='quantity' THEN qty::numeric/unit ELSE 1 END,6);
 IF subtotal<=0 THEN RAISE EXCEPTION 'F90_PRICE_MISSING'; END IF;
 discount:=round(subtotal*coalesce(vip_pct,0)/100,6);
 SELECT config INTO cfg FROM public.site_settings WHERE id=1;
 FOR cp IN SELECT value FROM jsonb_array_elements(coalesce(cfg->'coupons','[]')) LOOP
  IF upper(trim(p_coupon))=upper(cp->>'code') AND coalesce((cp->>'enabled')::boolean,false)
   AND (nullif(cp->>'starts_at','') IS NULL OR (cp->>'starts_at')::timestamptz<=now())
   AND (nullif(cp->>'ends_at','') IS NULL OR (cp->>'ends_at')::timestamptz>now())
   AND (jsonb_array_length(coalesce(cp->'product_ids','[]'))=0 OR (cp->'product_ids') ? p.id::text)
   AND subtotal>=coalesce(nullif(cp#>>'{minimum,USD}','')::numeric,0) THEN
   pct:=least(greatest(coalesce((cp->>'percent')::numeric,0),0),99);
   IF cp->>'type'='percent' THEN price:=round(subtotal*pct/100,6); ELSE price:=least(coalesce(nullif(cp#>>'{prices,USD}','')::numeric,0),subtotal-0.000001); END IF;
   IF price>discount THEN discount:=price;co:=upper(cp->>'code'); END IF;
  END IF;
 END LOOP;
 IF nullif(trim(p_coupon),'') IS NOT NULL AND co IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(cfg->'coupons','[]')) k WHERE upper(k->>'code')=upper(trim(p_coupon)) AND coalesce((k->>'enabled')::boolean,false)) THEN RAISE EXCEPTION 'F90_COUPON'; END IF;
 RETURN jsonb_build_object('product_id',p.id,'quantity',qty,'unit_quantity',unit,'subtotal_usd',subtotal,'discount_usd',discount,'total_usd',greatest(subtotal-discount,0.000001),'vip_level',v,'coupon_code',co,'spent_usd',spent);
END; $$;

CREATE OR REPLACE FUNCTION public.f90_checkout(p_user uuid,p_product uuid,p_quantity bigint,p_fields jsonb,p_key text,p_expected numeric,p_coupon text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.f90_orders%ROWTYPE;p public.products%ROWTYPE;q jsonb;bal numeric;total numeric;internal public.f90_product_internal%ROWTYPE;f jsonb;fname text;mode text;reservation boolean:=false;
BEGIN
 PERFORM f90_private.require_actor(p_user);
 IF p_key IS NULL OR length(p_key)<8 OR length(p_key)>160 THEN RAISE EXCEPTION 'F90_IDEMPOTENCY'; END IF;
 -- Serialize all purchases and deposits for this wallet, including idempotent retries.
 SELECT balance_usd INTO bal FROM public.f90_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO o FROM public.f90_orders WHERE user_id=p_user AND idempotency_key=p_key;
 IF FOUND THEN RETURN to_jsonb(o); END IF;
 SELECT * INTO p FROM public.products WHERE id=p_product FOR UPDATE;
 q:=public.f90_quote(p_user,p_product,p_quantity,p_coupon);total:=(q->>'total_usd')::numeric;
 IF p_expected IS NULL OR abs(p_expected-total)>0.000001 THEN RAISE EXCEPTION 'F90_PRICE_CHANGED'; END IF;
 IF bal IS NULL OR bal<total THEN RAISE EXCEPTION 'F90_INSUFFICIENT_BALANCE'; END IF;
 IF jsonb_typeof(p_fields)<>'object' OR length(p_fields::text)>12000 THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 IF jsonb_array_length(coalesce(p.commerce->'fields','[]'))=0 AND nullif(trim(p_fields->>'account_id'),'') IS NULL THEN RAISE EXCEPTION 'F90_ACCOUNT_ID'; END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(coalesce(p.commerce->'fields','[]')) LOOP
  fname:=f->>'id';IF coalesce((f->>'required')::boolean,false) AND nullif(trim(p_fields->>fname),'') IS NULL THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 END LOOP;
 SELECT * INTO internal FROM public.f90_product_internal WHERE product_id=p.id;
 mode:=coalesce(p.commerce->>'fulfillment','manual');
 IF mode='automatic' AND (internal.provider_id IS NULL OR internal.provider_service IS NULL OR NOT EXISTS(SELECT 1 FROM public.f90_providers WHERE id=internal.provider_id AND is_enabled AND secret_id IS NOT NULL)) THEN RAISE EXCEPTION 'F90_PROVIDER_NOT_READY'; END IF;
 IF p.stock IS NOT NULL THEN
  IF p.stock<1 THEN RAISE EXCEPTION 'F90_REFILLING'; END IF;
  UPDATE public.products SET stock=stock-1 WHERE id=p.id;reservation:=true;
 END IF;
 INSERT INTO public.f90_orders(user_id,product_id,product_name,product_image,quantity,unit_quantity,subtotal_usd,discount_usd,total_usd,cost_usd,vip_level,coupon_code,customer_fields,fulfillment,status,provider_id,provider_service,expected_minutes,idempotency_key,stock_reserved)
 VALUES(p_user,p.id,p.name,p.image_url,(q->>'quantity')::bigint,(q->>'unit_quantity')::bigint,(q->>'subtotal_usd')::numeric,(q->>'discount_usd')::numeric,total,
 CASE WHEN internal.cost_usd IS NULL THEN NULL ELSE round(internal.cost_usd*CASE WHEN p.commerce->>'type'='quantity' THEN (q->>'quantity')::numeric/(q->>'unit_quantity')::numeric ELSE 1 END,6) END,
 (q->>'vip_level')::smallint,q->>'coupon_code',p_fields,mode,CASE WHEN mode='automatic' THEN 'queued' ELSE 'pending' END,internal.provider_id,internal.provider_service,nullif(p.commerce->>'expected_minutes','')::integer,p_key,reservation) RETURNING * INTO o;
 UPDATE public.f90_wallets SET balance_usd=bal-total,updated_at=now() WHERE user_id=p_user;
 INSERT INTO public.f90_wallet_ledger(user_id,amount_usd,balance_after,kind,reference_id,description,unique_key)
 VALUES(p_user,-total,bal-total,'purchase',o.id,'شراء: '||p.name,'purchase:'||o.id);
 INSERT INTO public.f90_order_events(order_id,status,note) VALUES(o.id,o.status,'تم تأكيد الدفع من المحفظة');
 RETURN to_jsonb(o);
END; $$;

CREATE OR REPLACE FUNCTION public.f90_submit_deposit(p_user uuid,p_method text,p_currency text,p_amount numeric,p_receipt text,p_reference text,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE rate numeric;method jsonb;d public.f90_deposits%ROWTYPE;
BEGIN
 PERFORM f90_private.require_actor(p_user);
 SELECT * INTO d FROM public.f90_deposits WHERE user_id=p_user AND idempotency_key=p_key;IF FOUND THEN RETURN to_jsonb(d); END IF;
 IF p_amount<=0 OR p_amount>1000000 OR length(p_key)<8 THEN RAISE EXCEPTION 'F90_AMOUNT'; END IF;
 SELECT per_usd INTO rate FROM public.f90_rates WHERE currency=p_currency AND is_enabled;
 IF rate IS NULL THEN RAISE EXCEPTION 'F90_RATE_MISSING'; END IF;
 SELECT m INTO method FROM public.site_settings s,jsonb_array_elements(coalesce(s.config->'payment_methods','[]')) m WHERE s.id=1 AND m->>'id'=p_method AND coalesce((m->>'enabled')::boolean,false);
 IF method IS NULL THEN RAISE EXCEPTION 'F90_PAYMENT_METHOD'; END IF;
 IF split_part(p_receipt,'/',1)<>p_user::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='f90-receipts' AND name=p_receipt) THEN RAISE EXCEPTION 'F90_RECEIPT'; END IF;
 INSERT INTO public.f90_deposits(user_id,method_id,method_name,method_snapshot,currency,amount,rate_snapshot,usd_amount,receipt_path,reference,idempotency_key)
 VALUES(p_user,p_method,coalesce(method->>'name_ar',method->>'name',p_method),method,p_currency,p_amount,rate,round(p_amount/rate,6),p_receipt,left(p_reference,300),p_key) RETURNING * INTO d;
 RETURN to_jsonb(d);
END; $$;
CREATE OR REPLACE FUNCTION public.f90_review_deposit(p_actor uuid,p_id uuid,p_approve boolean,p_note text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d public.f90_deposits%ROWTYPE;bal numeric;
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager','admin']);
 SELECT * INTO d FROM public.f90_deposits WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
 IF d.status<>'pending' THEN RETURN to_jsonb(d); END IF;
 IF p_approve THEN
  SELECT balance_usd INTO bal FROM public.f90_wallets WHERE user_id=d.user_id FOR UPDATE;
  UPDATE public.f90_wallets SET balance_usd=bal+d.usd_amount,updated_at=now() WHERE user_id=d.user_id;
  INSERT INTO public.f90_wallet_ledger(user_id,amount_usd,balance_after,kind,reference_id,description,unique_key,actor_id)
  VALUES(d.user_id,d.usd_amount,bal+d.usd_amount,'deposit',d.id,'اعتماد إيداع: '||d.method_name,'deposit:'||d.id,p_actor);
 END IF;
 UPDATE public.f90_deposits SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,review_note=left(p_note,2000),reviewed_by=p_actor,reviewed_at=now() WHERE id=d.id RETURNING * INTO d;
 INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'deposit.review',d.id::text,jsonb_build_object('status',d.status,'usd',d.usd_amount));
 RETURN to_jsonb(d);
END; $$;

CREATE OR REPLACE FUNCTION public.f90_order_transition(p_actor uuid,p_id uuid,p_status text,p_note text DEFAULT '',p_refund numeric DEFAULT NULL,p_external text DEFAULT NULL,p_cost numeric DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.f90_orders%ROWTYPE;bal numeric;refund numeric:=0;
BEGIN
 IF p_actor IS NOT NULL THEN PERFORM f90_private.require_actor(p_actor,ARRAY['manager','admin']); END IF;
 SELECT * INTO o FROM public.f90_orders WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
 IF p_status NOT IN ('processing','completed','partial','failed','review','refunded') THEN RAISE EXCEPTION 'F90_STATUS'; END IF;
 IF o.status IN ('failed','refunded') THEN RETURN to_jsonb(o); END IF;
 IF o.status IN ('completed','partial') AND p_status NOT IN ('refunded') THEN RETURN to_jsonb(o); END IF;
 IF p_status='refunded' AND p_actor IS NOT NULL AND f90_private.require_actor(p_actor) <> 'manager' AND o.status IN ('completed','partial') THEN RAISE EXCEPTION 'F90_FORBIDDEN'; END IF;
 IF o.status='review' AND p_actor IS NULL AND p_status IN ('failed','refunded') THEN RAISE EXCEPTION 'F90_RECONCILE'; END IF;
 IF p_status IN ('failed','refunded') THEN refund:=o.total_usd-o.refunded_usd;
 ELSIF p_status='partial' THEN refund:=least(greatest(coalesce(p_refund,0),0),o.total_usd-o.refunded_usd); END IF;
 IF refund>0 THEN
  SELECT balance_usd INTO bal FROM public.f90_wallets WHERE user_id=o.user_id FOR UPDATE;
  UPDATE public.f90_wallets SET balance_usd=bal+refund,updated_at=now() WHERE user_id=o.user_id;
  INSERT INTO public.f90_wallet_ledger(user_id,amount_usd,balance_after,kind,reference_id,description,unique_key,actor_id)
  VALUES(o.user_id,refund,bal+refund,'refund',o.id,'استرداد: '||o.product_name,'refund:'||o.id||':'||(o.refunded_usd+refund)::text,p_actor);
 END IF;
 IF p_status IN ('failed','refunded') AND o.stock_reserved AND o.product_id IS NOT NULL THEN
  UPDATE public.products SET stock=stock+1 WHERE id=o.product_id AND stock IS NOT NULL;
 END IF;
 UPDATE public.f90_orders SET status=p_status,refunded_usd=refunded_usd+refund,stock_reserved=CASE WHEN p_status IN ('failed','refunded') THEN false ELSE stock_reserved END,
  provider_order_id=coalesce(p_external,provider_order_id),cost_usd=coalesce(p_cost,cost_usd),started_at=coalesce(started_at,now()),
  completed_at=CASE WHEN p_status IN ('completed','partial','failed','refunded') THEN now() ELSE completed_at END,
  next_sync_at=now()+interval '1 minute',updated_at=now() WHERE id=o.id RETURNING * INTO o;
 INSERT INTO public.f90_order_events(order_id,status,note) VALUES(o.id,p_status,left(p_note,2000));
 INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'order.'||p_status,o.id::text,jsonb_build_object('refund_usd',refund));
 RETURN to_jsonb(o);
END; $$;
CREATE OR REPLACE FUNCTION public.f90_claim_work() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE rows jsonb;
BEGIN
 -- Never redispatch an ambiguous network result. Staff must reconcile it first.
 UPDATE public.f90_orders SET status='review',updated_at=now() WHERE status='submitting' AND updated_at<now()-interval '5 minutes';
 WITH work AS (SELECT id FROM public.f90_orders WHERE fulfillment='automatic' AND status IN ('queued','processing') AND next_sync_at<=now() ORDER BY next_sync_at FOR UPDATE SKIP LOCKED LIMIT 10),
 claimed AS (UPDATE public.f90_orders o SET status=CASE WHEN o.status='queued' THEN 'submitting' ELSE o.status END,
 dispatch_attempts=o.dispatch_attempts+CASE WHEN o.status='queued' THEN 1 ELSE 0 END,started_at=coalesce(o.started_at,now()),next_sync_at=now()+interval '2 minutes',updated_at=now() FROM work w WHERE o.id=w.id RETURNING o.*)
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') INTO rows FROM claimed c;
 RETURN rows;
END; $$;
CREATE OR REPLACE FUNCTION public.f90_limit(p_key text,p_limit integer DEFAULT 60) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 INSERT INTO public.f90_rate_limits(key,window_start,hits) VALUES(p_key,date_trunc('minute',now()),1)
 ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN f90_rate_limits.window_start=date_trunc('minute',now()) THEN f90_rate_limits.hits+1 ELSE 1 END,window_start=date_trunc('minute',now()) RETURNING hits INTO n;
 RETURN n<=p_limit;
END; $$;
CREATE OR REPLACE FUNCTION public.f90_change_user(p_actor uuid,p_user uuid,p_role text DEFAULT NULL,p_status text DEFAULT NULL,p_vip smallint DEFAULT NULL,p_clear_vip boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_role text;
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager']);
 -- A shared advisory lock protects the last-manager invariant across two simultaneous edits.
 PERFORM pg_advisory_xact_lock(909007);
 SELECT role INTO old_role FROM public.f90_user_roles WHERE user_id=p_user FOR UPDATE;
 IF old_role='manager' AND (coalesce(p_role,'manager')<>'manager' OR coalesce(p_status,'active')<>'active') AND
 (SELECT count(*) FROM public.f90_user_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.role='manager' AND p.account_status='active')<=1 THEN RAISE EXCEPTION 'F90_LAST_MANAGER'; END IF;
 IF p_actor=p_user AND (coalesce(p_role,'manager')<>'manager' OR coalesce(p_status,'active')<>'active') THEN RAISE EXCEPTION 'F90_SELF_MANAGER'; END IF;
 IF p_role IS NOT NULL THEN UPDATE public.f90_user_roles SET role=p_role,updated_at=now() WHERE user_id=p_user; END IF;
 UPDATE public.profiles SET account_status=coalesce(p_status,account_status),vip_override=CASE WHEN p_clear_vip THEN NULL ELSE coalesce(p_vip,vip_override) END WHERE id=p_user;
 INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'user.permissions',p_user::text,jsonb_build_object('role',p_role,'status',p_status,'vip',p_vip));
 RETURN (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id=p_user);
END; $$;
CREATE OR REPLACE FUNCTION public.f90_review_verification(p_actor uuid,p_id uuid,p_approve boolean,p_note text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v public.f90_verifications%ROWTYPE;
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager','admin']);
 SELECT * INTO v FROM public.f90_verifications WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
 IF v.status<>'pending' THEN RETURN to_jsonb(v); END IF;
 UPDATE public.f90_verifications SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,review_note=left(p_note,2000),reviewed_by=p_actor,reviewed_at=now() WHERE id=p_id RETURNING * INTO v;
 UPDATE public.profiles SET is_verified=p_approve WHERE id=v.user_id;
 INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'identity.review',p_id::text,jsonb_build_object('approved',p_approve));RETURN to_jsonb(v);
END; $$;
CREATE OR REPLACE FUNCTION public.f90_report(p_actor uuid,p_month date) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE start_at timestamptz;end_at timestamptz;result jsonb;
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager','admin']);
 start_at:=date_trunc('month',p_month::timestamp) AT TIME ZONE 'Asia/Hebron';end_at:=(date_trunc('month',p_month::timestamp)+interval '1 month') AT TIME ZONE 'Asia/Hebron';
 SELECT jsonb_build_object('month',to_char(p_month,'YYYY-MM'),'timezone','Asia/Hebron',
  'users',(SELECT count(*) FROM public.profiles),'active_30d',(SELECT count(*) FROM public.profiles WHERE last_seen_at>now()-interval '30 days'),
  'new_users',(SELECT count(*) FROM public.profiles WHERE created_at>=start_at AND created_at<end_at),
  'orders',(SELECT count(*) FROM public.f90_orders WHERE created_at>=start_at AND created_at<end_at),
  'pending_orders',(SELECT count(*) FROM public.f90_orders WHERE status IN ('pending','queued','submitting','processing','review')),
  'pending_deposits',(SELECT count(*) FROM public.f90_deposits WHERE status='pending'),
  'wallet_liability',(SELECT coalesce(sum(balance_usd),0) FROM public.f90_wallets),
  'revenue_usd',coalesce(sum(total_usd-refunded_usd),0),
  'known_cost_usd',coalesce(sum(cost_usd) FILTER(WHERE cost_usd IS NOT NULL),0),
  'known_profit_usd',coalesce(sum(total_usd-refunded_usd-cost_usd) FILTER(WHERE cost_usd IS NOT NULL),0),
  'unpriced_cost_orders',count(*) FILTER(WHERE cost_usd IS NULL),
  'leaderboard',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT p.customer_id,p.display_name,p.avatar_url,p.id as user_id,sum(o.total_usd-o.refunded_usd) as spent_usd,count(*) as orders FROM public.f90_orders o JOIN public.profiles p ON p.id=o.user_id WHERE o.status IN ('completed','partial') AND o.completed_at>=start_at AND o.completed_at<end_at GROUP BY p.id ORDER BY spent_usd DESC LIMIT 100) x)
 ) INTO result FROM public.f90_orders WHERE status IN ('completed','partial') AND completed_at>=start_at AND completed_at<end_at;
 RETURN result;
END; $$;

-- Private uploads. Ownership and roles are checked again when consuming an uploaded file.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('f90-avatars','f90-avatars',true,5242880,ARRAY['image/jpeg','image/png','image/webp','image/gif']),
 ('f90-receipts','f90-receipts',false,5242880,ARRAY['image/jpeg','image/png','image/webp']),
 ('f90-identity','f90-identity',false,5242880,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
UPDATE storage.buckets SET allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/gif'] WHERE id='f90-images';
CREATE POLICY f90_avatar_public ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='f90-avatars');
CREATE POLICY f90_avatar_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='f90-avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (SELECT f90_private.my_role()) IS NOT NULL);
CREATE POLICY f90_avatar_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='f90-avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text) WITH CHECK(bucket_id='f90-avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (SELECT f90_private.my_role()) IS NOT NULL);
CREATE POLICY f90_avatar_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='f90-avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (SELECT f90_private.my_role()) IS NOT NULL);
CREATE POLICY f90_private_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id IN ('f90-receipts','f90-identity') AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (SELECT f90_private.my_role()) IS NOT NULL);
CREATE POLICY f90_private_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id IN ('f90-receipts','f90-identity') AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (SELECT f90_private.my_role()) IS NOT NULL);
CREATE POLICY f90_designer_images_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='f90-images' AND (SELECT f90_private.my_role()) IN ('manager','designer'));
CREATE POLICY f90_designer_images_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='f90-images' AND (SELECT f90_private.my_role()) IN ('manager','designer'));
CREATE POLICY f90_designer_images_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='f90-images' AND (SELECT f90_private.my_role()) IN ('manager','designer')) WITH CHECK(bucket_id='f90-images' AND (SELECT f90_private.my_role()) IN ('manager','designer'));
CREATE POLICY f90_designer_images_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='f90-images' AND (SELECT f90_private.my_role()) IN ('manager','designer'));

-- Keep authorization helpers internal; only the Edge Function can call application RPCs.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'f90_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='f90_private'::regnamespace AND proname IN ('require_actor','category_acyclic') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA vault TO service_role;
GRANT SELECT ON vault.decrypted_secrets TO service_role;
GRANT EXECUTE ON FUNCTION vault.create_secret(text,text,text,uuid),vault.update_secret(uuid,text,text,text,uuid) TO service_role;
GRANT SELECT ON auth.sessions TO service_role;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='f90-worker') THEN
  PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'f90-worker','Internal F90 order worker');
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.f90_worker_authorized(p_hash text) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='f90-worker' AND encode(extensions.digest(decrypted_secret,'sha256'),'hex')=p_hash); $$;
REVOKE ALL ON FUNCTION public.f90_worker_authorized(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_worker_authorized(text) TO service_role;
CREATE OR REPLACE FUNCTION f90_private.tick() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE secret text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.f90_orders WHERE fulfillment='automatic' AND (status IN ('queued','processing') AND next_sync_at<=now() OR status='submitting' AND updated_at<now()-interval '5 minutes')) THEN RETURN; END IF;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='f90-worker';
 PERFORM net.http_post(url:='https://xzqnrpycjxfbyrfaolud.supabase.co/functions/v1/f90-platform',
  headers:=jsonb_build_object('Content-Type','application/json','x-f90-worker',secret),body:='{"action":"worker"}'::jsonb,timeout_milliseconds:=60000);
END; $$;
REVOKE ALL ON FUNCTION f90_private.tick() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('f90-orders-worker','* * * * *','SELECT f90_private.tick();');
COMMIT;
