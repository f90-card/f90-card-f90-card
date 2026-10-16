-- Salary alerts are idempotent; no financial ledger mutation.
ALTER TABLE public.f90_telegram_alerts
 DROP CONSTRAINT IF EXISTS f90_telegram_alerts_event_type_check;
ALTER TABLE public.f90_telegram_alerts
 ADD CONSTRAINT f90_telegram_alerts_event_type_check
 CHECK (event_type IN ('deposit_new','verification_new','order_review','test',
                      'user_new','order_manual','manual_request','salary_new'));
CREATE OR REPLACE FUNCTION f90_private.telegram_enqueue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE ev text; key text; content jsonb; opt text;
BEGIN
 IF TG_TABLE_NAME='f90_deposits' THEN
   ev:='deposit_new';key:='deposit:'||NEW.id::text;opt:='deposits_enabled';
   content:=jsonb_build_object('id',NEW.id,'amount',NEW.amount,'currency',NEW.currency,'method',left(coalesce(NEW.method_name,NEW.method_id),90),'created_at',NEW.created_at);
 ELSIF TG_TABLE_NAME='f90_salary_requests' THEN
   ev:='salary_new';key:='salary:'||NEW.id::text;opt:='salary_enabled';
   content:=jsonb_build_object('id',NEW.id,'coins',NEW.coins,'currency',NEW.payout_currency,
      'payout_amount',NEW.payout_amount,'usd_amount',NEW.usd_amount,'created_at',NEW.created_at);
 ELSIF TG_TABLE_NAME='f90_verifications' THEN
   ev:='verification_new';key:='verification:'||NEW.id::text;opt:='verification_enabled';
   content:=jsonb_build_object('id',NEW.id,'created_at',NEW.created_at);
 ELSIF TG_TABLE_NAME='profiles' THEN
   ev:='user_new';key:='user:'||NEW.id::text;opt:='new_users_enabled';
   content:=jsonb_build_object('id',NEW.id,'created_at',NEW.created_at);
 ELSIF TG_TABLE_NAME='f90_orders' THEN
   IF NEW.fulfillment IS DISTINCT FROM 'manual' THEN RETURN NEW; END IF;
   ev:='order_manual';key:='manual-order:'||NEW.id::text;opt:='manual_orders_enabled';
   content:=jsonb_build_object('id',NEW.id,'order_number',NEW.order_number,
      'product_name',left(coalesce(NEW.product_name,''),130),
      'total_usd',NEW.total_usd,'created_at',NEW.created_at);
 ELSIF TG_TABLE_NAME='f90_special_requests' THEN
   ev:='manual_request';key:='special:'||NEW.id::text;opt:='manual_requests_enabled';
   content:=jsonb_build_object('id',NEW.id,'service',left(coalesce(NEW.service,''),130),
      'kind',NEW.kind,'created_at',NEW.created_at);
 ELSIF TG_TABLE_NAME='f90_order_requests' THEN
   ev:='order_review';key:='order-review:'||NEW.id::text;opt:='order_reviews_enabled';
   content:=jsonb_build_object('id',NEW.id,'order_id',NEW.order_id,'kind',NEW.kind,'created_at',NEW.created_at);
 ELSE RETURN NEW; END IF;
 IF EXISTS (
   SELECT 1 FROM public.site_settings
   WHERE id=1 AND config->'telegram_alerts'->>opt='false'
 ) THEN RETURN NEW; END IF;
 INSERT INTO public.f90_telegram_alerts(event_key,event_type,payload)
 VALUES(key,ev,content)
 ON CONFLICT(event_key) DO NOTHING;
 RETURN NEW;
END $function$
;
DROP TRIGGER IF EXISTS f90_telegram_on_salary ON public.f90_salary_requests;
CREATE TRIGGER f90_telegram_on_salary AFTER INSERT ON public.f90_salary_requests
FOR EACH ROW EXECUTE FUNCTION f90_private.telegram_enqueue();
INSERT INTO public.f90_telegram_alerts(event_key,event_type,payload)
SELECT 'salary:'||s.id::text,'salary_new',
  jsonb_build_object('id',s.id,'coins',s.coins,'currency',s.payout_currency,
    'payout_amount',s.payout_amount,'usd_amount',s.usd_amount,'created_at',s.created_at)
FROM public.f90_salary_requests s WHERE s.status='pending'
ON CONFLICT(event_key) DO NOTHING;
UPDATE public.f90_rates SET is_enabled=false WHERE currency='XCN' AND is_enabled=true;
UPDATE public.site_settings
SET config=jsonb_set(
      jsonb_set(
       jsonb_set(config,'{telegram_alerts,salary_enabled}','true'::jsonb,true),
       '{salary_withdrawal,payout_options}',
       (SELECT coalesce(jsonb_agg(item ORDER BY i),'[]'::jsonb)
        FROM jsonb_array_elements(coalesce(config->'salary_withdrawal'->'payout_options','[]'::jsonb))
         WITH ORDINALITY as t(item,i)
        WHERE item->>'currency' IN ('USD','ILS','JOD')),
       true),
      '{payment_methods}',
      (SELECT coalesce(jsonb_agg(
         case when jsonb_typeof(item->'accepted_currencies')='array'
          then jsonb_set(item,'{accepted_currencies}',
           (SELECT coalesce(jsonb_agg(to_jsonb(curr)),'[]'::jsonb)
             FROM jsonb_array_elements_text(item->'accepted_currencies') as v(curr)
             WHERE curr IN ('USD','ILS','JOD')),true)
          else item end ORDER BY i),'[]'::jsonb)
       FROM jsonb_array_elements(coalesce(config->'payment_methods','[]'::jsonb))
        WITH ORDINALITY as t(item,i)),true),
 updated_at=now()
WHERE id=1;