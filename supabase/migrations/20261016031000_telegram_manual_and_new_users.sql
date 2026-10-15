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
END $function$;

DROP TRIGGER IF EXISTS f90_telegram_on_new_user ON public.profiles;
CREATE TRIGGER f90_telegram_on_new_user AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION f90_private.telegram_enqueue();
DROP TRIGGER IF EXISTS f90_telegram_on_manual_order ON public.f90_orders;
CREATE TRIGGER f90_telegram_on_manual_order AFTER INSERT ON public.f90_orders
FOR EACH ROW EXECUTE FUNCTION f90_private.telegram_enqueue();
DROP TRIGGER IF EXISTS f90_telegram_on_manual_request ON public.f90_special_requests;
CREATE TRIGGER f90_telegram_on_manual_request AFTER INSERT ON public.f90_special_requests
FOR EACH ROW EXECUTE FUNCTION f90_private.telegram_enqueue();
