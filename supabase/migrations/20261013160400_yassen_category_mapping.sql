CREATE OR REPLACE FUNCTION f90_private.yassen_category_id(supplier_category text, product_name text)
RETURNS uuid LANGUAGE plpgsql STABLE SET search_path TO '' AS $category$
DECLARE label text:=lower(regexp_replace(trim(coalesce(supplier_category,'')),'[[:space:]]+',' ','g'));
        target text; result uuid;
BEGIN
 SELECT id INTO result FROM public.categories
 WHERE lower(regexp_replace(trim(name),'[[:space:]]+',' ','g'))=label
 ORDER BY created_at LIMIT 1;
 IF result IS NOT NULL THEN RETURN result; END IF;
 target:=CASE
  WHEN label ~ '(pubg|ببجي)' AND label ~ '(code|كود)' THEN 'ببجي موبايل اكواد عالمية'
  WHEN label ~ '(pubg|ببجي)' AND label ~ '(auto|اتوماتيك|أتوماتيك)' THEN 'ببجي اتوماتيك'
  WHEN label ~ '(pubg|ببجي)' AND label ~ '(تركي|turk)' THEN 'ببجي تركي'
  WHEN label ~ '(pubg|ببجي)' AND label ~ '(عضوي|member)' THEN 'عضويات ببجي'
  WHEN label ~ '(pubg|ببجي)' AND label ~ '(new state|نيو)' THEN 'ببجي نيو تسيت'
  WHEN label ~ '(pubg|ببجي)' THEN 'ببجي موبايل العالمية'
  WHEN label ~ '(free fire|فري فاير)' THEN 'فري فاير'
  WHEN label ~ '(yalla ludo|يلا لودو)' THEN 'يلا لودو'
  WHEN label ~ '(clash of clan|كلاش اوف كلانس)' THEN 'كلاش اوف كلانس'
  WHEN label ~ '(clash royale)' THEN 'Clash Royale'
  WHEN label ~ '(jawaker|جواكر)' THEN 'جواكر'
  WHEN label ~ '(8ball|8 ball)' AND label ~ '(cash|كاش)' THEN '8ball pool كاش'
  WHEN label ~ '(8ball|8 ball)' THEN '8ball pool كوينز'
  WHEN label ~ '(mobile legend|موبايل ليجندز)' THEN 'موبايل ليجندز'
  WHEN label ~ '(call of duty|كول اوف ديوتي)' THEN 'كول اوف ديوتي'
  WHEN label ~ '(roblox|روبلكس)' THEN 'روبلكس'
  WHEN label ~ '(fc mobile)' THEN 'FC MOBILE'
  WHEN label ~ '(genshin)' THEN 'genshin impact'
  WHEN label ~ '(blood strike|بلود سترايك)' THEN 'بلود سترايك'
  WHEN label ~ '(weplay|وي بلاي)' THEN 'وي بلاي'
  WHEN label ~ '(king of avalon)' THEN 'King of Avalon'
  WHEN label ~ '(delta force garena)' THEN 'DELTA FORCE GARENA'
  WHEN label ~ '(delta force)' THEN 'دلتا فورس'
  WHEN label ~ '(war robots)' THEN 'وار روبوتس'
  WHEN label ~ '(immortal kingdoms)' THEN 'IMMORTAL KINGDOMS'
  WHEN label ~ '(infinity kingdom)' THEN 'infinity kingdom'
  WHEN label ~ '(merge kingdom)' THEN 'MERGE KINGDOM'
  WHEN label ~ '(farlight)' THEN 'FARLIGHT'
  WHEN label ~ '(lords mobile)' THEN 'لورد موبايل'
  WHEN label ~ '(arena breakout)' THEN 'ARENA BREAKOUT'
  WHEN label ~ '(zenless)' THEN 'ZENLESS ZONE ZERO'
  WHEN label ~ '(state of survival|state survival)' THEN 'state survival'
  WHEN label ~ '(guns of glory)' THEN 'GUNS OF GLORY'
  WHEN label ~ '(life after)' THEN 'LIFE AFTER'
  WHEN label ~ '(honor of kings)' THEN 'HONOR OF KINGS'
  WHEN label ~ '(valorant)' THEN 'VALORANT'
  WHEN label ~ '(whiteout)' THEN 'Whiteout Survival'
  WHEN label ~ '(where winds)' THEN 'Where Winds Meet'
  WHEN label ~ '(hero clash)' THEN 'Hero Clash'
  WHEN label ~ '(identity v)' THEN 'Identity V'
  WHEN label ~ '(itunes|steam|gift|voucher|بطاق|كود)' THEN 'البطاقات الرقمية'
  WHEN label ~ '(netflix|disney|shahid|شاهد|مشاهدة)' THEN 'اشتراكات المشاهدة'
  WHEN label ~ '(facebook|instagram|tik tok|tiktok|twitter|youtube|telegram|whatsapp)' THEN 'خدمات السوشيال ميديا'
  WHEN label ~ '(gemini|chatgpt|ذكاء)' THEN 'الذكاء الاصطناعي'
  WHEN label ~ '(اتصالات|syriatel|alfa|رصيد جوال)' THEN 'أرصدة الجوال'
  WHEN label ~ '(live|chat|shipment|cam|شحن التطبيقات)' THEN 'شحن التطبيقات'
  ELSE 'خدمات الموقع' END;
 SELECT id INTO result FROM public.categories WHERE name=target ORDER BY created_at LIMIT 1;
 IF result IS NULL THEN SELECT id INTO result FROM public.categories WHERE slug='store-services' LIMIT 1; END IF;
 RETURN result;
END; $category$;

CREATE OR REPLACE FUNCTION f90_private.yassen_import_pending()
RETURNS integer LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE p record; response record; payload jsonb; created integer:=0;
BEGIN
 SELECT id,config,margin_percent INTO p FROM public.f90_providers
 WHERE adapter='yassen' AND is_enabled AND config->>'archived_at' IS NULL
   AND config->>'sync_state'='pending' LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN 0; END IF;
 SELECT status_code,content,error_msg,timed_out INTO response FROM net._http_response
 WHERE id=(p.config->>'sync_request_id')::bigint;
 IF NOT FOUND THEN RETURN 0; END IF;
 IF response.status_code<>200 OR response.error_msg IS NOT NULL OR
    response.timed_out OR length(response.content)>2000000 THEN
   RAISE EXCEPTION 'Supplier response unavailable';
 END IF;
 payload:=response.content::jsonb;
 IF jsonb_typeof(payload)<>'array' OR jsonb_array_length(payload)<100 OR
    jsonb_array_length(payload)>5000 THEN
   RAISE EXCEPTION 'Supplier product list invalid';
 END IF;
 IF (SELECT count(*)<>count(DISTINCT item->>'id') FROM jsonb_array_elements(payload) item) THEN
   RAISE EXCEPTION 'Supplier product IDs are not unique';
 END IF;

 WITH source AS (
   SELECT item AS e FROM jsonb_array_elements(payload) item
   WHERE item->>'available'='true'
     AND jsonb_typeof(item->'price')='number'
     AND (item->>'price')::numeric>0
     AND item->>'id' ~ '^[0-9]+$'
 ), limits AS (
   SELECT e,(e->>'price')::numeric unit_cost,
     CASE WHEN jsonb_typeof(e->'qty_values')='object' THEN
       CASE WHEN e->'qty_values'->>'min' ~ '^[0-9]+$' THEN (e->'qty_values'->>'min')::numeric END
       WHEN jsonb_typeof(e->'qty_values')='array' THEN
         (SELECT min(v::numeric) FROM jsonb_array_elements_text(e->'qty_values') v
          WHERE v ~ '^[0-9]+$') ELSE 1 END mn,
     CASE WHEN jsonb_typeof(e->'qty_values')='object' THEN
       CASE WHEN e->'qty_values'->>'max' ~ '^[0-9]+$' THEN (e->'qty_values'->>'max')::numeric END
       WHEN jsonb_typeof(e->'qty_values')='array' THEN
         (SELECT max(v::numeric) FROM jsonb_array_elements_text(e->'qty_values') v
          WHERE v ~ '^[0-9]+$') ELSE 1 END mx
   FROM source
 ), prepared AS (
   SELECT e,unit_cost,mn::integer mn,mx::integer mx,
     CASE WHEN unit_cost<0.00001 THEN 1000000
          WHEN unit_cost<0.01 THEN 1000 ELSE 1 END scale,
     f90_private.yassen_category_id(e->>'category_name',e->>'name') category_id,
     CASE WHEN jsonb_typeof(e->'params')='array' AND jsonb_array_length(e->'params')>0 THEN
       (SELECT jsonb_agg(jsonb_build_object('id','param_'||ord,'label_ar',left(label,150),
         'type','text','required',true) ORDER BY ord)
        FROM jsonb_array_elements_text(e->'params') WITH ORDINALITY t(label,ord))
       ELSE '[{"id":"account_id","label_ar":"رابط أو معرّف الحساب","type":"text","required":true}]'::jsonb
     END fields
   FROM limits WHERE mn BETWEEN 1 AND 1000000000 AND mx BETWEEN mn AND 1000000000
     AND length(e->>'id')<=100 AND nullif(trim(e->>'name'),'') IS NOT NULL
 ), inserted AS (
   INSERT INTO public.products(name,slug,description,price,currency,category_id,is_active,commerce)
   SELECT left(q.e->>'name',200),'yassen-'||(q.e->>'id'),
      'أف تسعين كارد · '||left(coalesce(q.e->>'category_name',''),180),
      round(q.unit_cost*q.scale*(1+p.margin_percent/100),6),'USD',c.id,false,
      jsonb_build_object('type','quantity','fulfillment','manual','unit_quantity',q.scale,
        'quantity_min',q.mn,'quantity_max',q.mx,'quantity_step',1,
        'prices',jsonb_build_object('USD',round(q.unit_cost*q.scale*(1+p.margin_percent/100),6)),
        'fields',q.fields,
        'supplier_quantity_values',CASE WHEN jsonb_typeof(q.e->'qty_values')='array'
          THEN q.e->'qty_values' ELSE NULL END)
   FROM prepared q JOIN public.categories c ON c.id=q.category_id
   WHERE q.unit_cost*q.scale*(1+p.margin_percent/100)>=0.01
     AND NOT EXISTS (SELECT 1 FROM public.products old WHERE old.slug='yassen-'||(q.e->>'id'))
   ON CONFLICT(slug) DO NOTHING RETURNING id,slug
 ), mapped AS (
   INSERT INTO public.f90_product_internal(product_id,provider_id,provider_service,cost_usd,auto_margin)
   SELECT i.id,p.id,substring(i.slug from 8),round(q.unit_cost*q.scale,6),true
   FROM inserted i JOIN prepared q ON i.slug='yassen-'||(q.e->>'id')
   RETURNING product_id
 ) SELECT count(*) INTO created FROM mapped;

 UPDATE public.f90_providers SET config=(config-'sync_request_id')||
   jsonb_build_object('sync_state','ok','sync_last_success',now(),
     'sync_created_drafts',created) WHERE id=p.id;
 RETURN created;
EXCEPTION WHEN OTHERS THEN
 IF p.id IS NOT NULL THEN
   UPDATE public.f90_providers SET config=(config-'sync_request_id')||
     jsonb_build_object('sync_state','error','sync_last_error',now(),
       'sync_error','تعذّرت مزامنة قائمة المورّد') WHERE id=p.id;
 END IF;
 RETURN 0;
END; $function$;

