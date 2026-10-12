BEGIN;
-- Consolidate legacy policies. Financial/catalog mutations now pass through the server.
DO $$ DECLARE p record;t text;BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN('profiles','user_roles','orders','order_items','categories','products','banners','site_settings') LOOP
  EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['categories','products','banners'] LOOP
  EXECUTE format('CREATE POLICY f90_catalog_public ON public.%I FOR SELECT TO anon,authenticated USING(is_active)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['f90_providers','f90_product_internal','f90_api_keys','f90_audit','f90_rate_limits'] LOOP
  EXECUTE format('CREATE POLICY f90_server_only ON public.%I FOR ALL TO anon,authenticated USING(false) WITH CHECK(false)',t);
 END LOOP;
END $$;
CREATE POLICY f90_settings_public ON public.site_settings FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY f90_profile_owner ON public.profiles FOR SELECT TO authenticated USING(id=(SELECT auth.uid()) AND (SELECT f90_private.my_role()) IS NOT NULL);
CREATE POLICY f90_legacy_role_owner ON public.user_roles FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY f90_legacy_order_owner ON public.orders FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND (SELECT f90_private.my_role()) IS NOT NULL);
CREATE POLICY f90_legacy_item_owner ON public.order_items FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.user_id=(SELECT auth.uid())));
REVOKE INSERT,UPDATE,DELETE ON public.orders,public.order_items FROM anon,authenticated;
CREATE INDEX IF NOT EXISTS f90_deposit_currency ON public.f90_deposits(currency);
CREATE INDEX IF NOT EXISTS f90_provider_currency ON public.f90_providers(currency);
CREATE INDEX IF NOT EXISTS f90_legacy_order_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS f90_legacy_item_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS f90_legacy_item_product ON public.order_items(product_id);
ALTER TABLE public.f90_verifications ADD COLUMN erased_at timestamptz;

-- Provided original artwork. Draft/empty categories are visibly marked as refilling.
DO $$ DECLARE games uuid;apps uuid;pubg uuid;c record;BEGIN
 SELECT id INTO games FROM public.categories WHERE parent_id IS NULL AND (name ILIKE '%العاب%' OR name ILIKE '%ألالعاب%' OR slug='games') ORDER BY created_at LIMIT 1;
 IF games IS NULL THEN INSERT INTO public.categories(name,slug,image_url,sort_order) VALUES('الألعاب','games','./assets/sections/games.png',0) RETURNING id INTO games;
 ELSE UPDATE public.categories SET name='الألعاب',image_url='./assets/sections/games.png',sort_order=0 WHERE id=games;END IF;
 INSERT INTO public.categories(name,slug,image_url,sort_order) VALUES('شحن التطبيقات','applications','./assets/sections/apps.png',1) ON CONFLICT(slug) DO NOTHING;
 SELECT id INTO apps FROM public.categories WHERE slug='applications';
 FOR c IN SELECT * FROM (VALUES('اشتراكات المشاهدة','streaming','streaming',2),('الذكاء الاصطناعي','artificial-intelligence','ai',3),('خدمات السوشيال ميديا','social-media','social',4),('البطاقات الرقمية','digital-cards','cards',5),('أرصدة الجوال','mobile-credit','mobile',6),('خدمات الموقع','store-services','services',7)) AS items(name,slug,asset,sort) LOOP
  INSERT INTO public.categories(name,slug,image_url,sort_order) VALUES(c.name,c.slug,'./assets/sections/'||c.asset||'.png',c.sort) ON CONFLICT(slug) DO NOTHING;
 END LOOP;
 INSERT INTO public.categories(name,slug,parent_id,image_url,sort_order,presentation) VALUES('ببجي','pubg',games,'./assets/sections/games.png',0,'{"layout":"packs","routing":"auto"}') ON CONFLICT(slug) DO NOTHING;
 SELECT id INTO pubg FROM public.categories WHERE slug='pubg';
 UPDATE public.products SET category_id=pubg WHERE category_id=games AND (name ILIKE '%ببجي%' OR name ILIKE '%pubg%');
 UPDATE public.products SET category_id=apps WHERE category_id=games AND commerce->>'type'='quantity';
END $$;
UPDATE public.products SET commerce=(commerce - 'name_en' - 'description_en' - 'quantity_label_en' - 'delivery_time_en') ||
 jsonb_build_object('fulfillment',coalesce(commerce->>'fulfillment','manual'),'availability',coalesce(commerce->>'availability','available'),
 'fields',CASE WHEN jsonb_array_length(coalesce(commerce->'fields','[]'))=0 THEN '[{"id":"account_id","label_ar":"معرّف حسابك","type":"text","required":true}]'::jsonb ELSE commerce->'fields' END);

DO $$ DECLARE cfg jsonb;pages jsonb;methods jsonb;BEGIN
 SELECT config INTO cfg FROM public.site_settings WHERE id=1;
 pages:=jsonb_build_object(
 'about',jsonb_build_object('enabled',true,'ar',E'أف تسعين كارد متجر للخدمات الرقمية، مقره فلسطين، رام الله.\n\nنجمع خدمات شحن الألعاب والتطبيقات والاشتراكات والبطاقات وغيرها بحسب المنتجات المنشورة. بعض الخدمات تنفذها الإدارة يدويًا، وبعضها يُنفّذ عبر مورّد مرتبط. تظهر طريقة التنفيذ والسعر والبيانات المطلوبة داخل صفحة كل خدمة.\n\nحسابك هو مركز تجربتك: محفظة بالدولار، طلبات محفوظة، سجل حركات، ومستويات تميّز. شراء الخدمات يتم داخل الموقع من رصيد معتمد، والتواصل عبر واتساب خيار للدعم عند الحاجة.\n\nللاستفسارات والتعاون والتوزيع، استخدم صفحة الدعم أو صفحة وكلائنا والمبرمجين.'),
 'terms',jsonb_build_object('enabled',true,'ar',E'بإنشاء حساب أو تقديم طلب، توافق على البيانات والسياسات المعروضة قبل التأكيد.\n\nأدخل بريدًا صحيحًا ومعلومات تخصك أو تملك صلاحية استخدامها. الهاتف اختياري، ويمكن التسجيل بالبريد أو جوجل عندما يكون المزوّد مفعّلًا. أنت مسؤول عن حماية بيانات الدخول ورمز المصادقة ومفتاح التاجر.\n\nيتطلب الشراء تسجيل الدخول ورصيدًا كافيًا في المحفظة. السعر النهائي بالدولار يظهر قبل التأكيد ويُعاد التحقق منه على الخادم. أي تغيير في السعر يتطلب مراجعة الإجمالي مجددًا. يعكس عرض العملات الأخرى سعر الصرف الذي تحدده الإدارة، وليس تغذية مباشرة لأسعار السوق.\n\nلا يجوز إساءة استخدام الموقع أو انتحال الهوية أو استخدام الخدمات بما يخالف شروط المنصة المستهدفة. يحق للإدارة إيقاف العمليات أو مراجعتها عند وجود مشكلة في الحساب أو التحويل أو بيانات الطلب، مع حفظ سجلات الرصيد والطلبات.\n\nالمواعيد تقديرية ما لم ينص وصف الخدمة على خلاف ذلك. تُراجع الحقوق المقررة في القوانين الواجبة التطبيق وأي نزاع أو طلب استرداد وفق طبيعة الخدمة وحالة تنفيذها.'),
 'privacy',jsonb_build_object('enabled',true,'ar',E'نستخدم معلومات الحساب والبريد والصورة والهاتف الاختياري لإدارة حسابك والتواصل بشأن خدماتك. نحفظ الطلبات وبيانات الحساب المستهدف والإيداعات وحركات المحفظة وسجلات مراجعة الإدارة في قاعدة بيانات المتجر.\n\nتصل بيانات التنفيذ الضرورية إلى المورّد عند شراء خدمة آلية. لا يُشارك معها رصيد محفظتك أو مستندات التوثيق. خدمات المصادقة والاستضافة والتخزين تدعم تشغيل الموقع، وقد تعالج البيانات في مناطق استضافتها.\n\nصور إيصالات الإيداع ومستندات الهوية محفوظة في مساحات خاصة، ويطلع عليها موظفون مخوّلون للمراجعة من روابط قصيرة الصلاحية. لا تظهر هذه الصور في صفحات المتجر العامة. توثيق الهوية اختياري، ويحتاج موافقة الإدارة لإظهار شارة موثّق.\n\nيحتفظ المتصفح بجلسة الدخول واختيار المظهر والعملة والمفضلة. لا يخزن تطبيق العمل دون اتصال ردود المحفظة أو الإيصالات أو مستندات الهوية.\n\nلطلب تصحيح بياناتك أو حذف مستندات توثيق راجعتها الإدارة أو الاستفسار عن الاحتفاظ بسجلات المعاملات، تواصل عبر صفحة الدعم. قد تبقى السجلات المالية اللازمة للمحاسبة وتسوية النزاعات. لا ترسل كلمات المرور أو رموز المصادقة للدعم.'),
 'purchase',jsonb_build_object('enabled',true,'ar',E'اختر القسم ثم الخدمة، وراجع صورتها ووصفها وطريقة تنفيذها. حدد الكمية ضمن الحدود المطلوبة وأدخل معرّف الحساب أو الحقول المحددة.\n\nتُحسب الخدمات ذات الكمية وفق السعر لكل وحدة تسعير: مثل كل ألف أو كل مليون. تُحسب الباقات الثابتة بسعر الباقة. يعرض الموقع الإجمالي النهائي بالدولار، والتحويلات المتاحة بالشيكل والدينار أو العملات المفعّلة.\n\nيُخصم المبلغ من المحفظة عند تأكيد الطلب. إذا لم يكفِ الرصيد فلن يُنشأ طلب شراء ولن تصبح المحفظة سالبة. الخدمة قيد التعبئة لا تقبل الشراء. لا تحتاج إرسال رسالة واتساب لإتمام الشراء.\n\nيبدأ الطلب اليدوي في متابعة الإدارة، ويُرسل الطلب الآلي إلى المورّد. إذا ثبت فشل التنفيذ، يُعاد المبلغ المستحق إلى المحفظة مرة واحدة. الخدمة الجزئية يمكن أن تحصل على استرداد نسبي بحسب النتيجة المعتمدة. إذا كانت نتيجة المورّد غير مؤكدة، يتوقف الطلب للمراجعة قبل الاسترداد أو إعادة الإرسال.\n\nبعد التنفيذ، يراجع الدعم أي اعتراض وفق وصف الخدمة وحالة الطلب. بيانات الحساب غير الصحيحة قد تؤثر على إمكانية التسليم والاسترداد؛ راجعها قبل التأكيد. الاسترداد المسجل داخل النظام بالدولار إلى المحفظة، وأي تسوية خارجية تتطلب مراجعة الإدارة.\n\nتزداد مستويات التميّز مع صافي الإنفاق في الطلبات المكتملة. عند استخدام كوبون يُطبق الخصم الأعلى دون جمع الخصومات. قد يختلف سعر التاجر عن سعر العميل.'),
 'usage',jsonb_build_object('enabled',true,'ar',E'استخدم الخدمات على حسابات تملكها أو تملك إذنًا باستخدامها، ووفق شروط التطبيق أو اللعبة أو المنصة المستهدفة.\n\nلا تطلب خدمات تهدف إلى احتيال أو انتهاك حقوق الغير أو التحايل على الحماية. لا ترفع بيانات ضارة أو روابط حساسة أو مستندات تخص شخصًا آخر.\n\nراجع حدود الكمية ونوع الخدمة ومتطلباتها قبل الشراء. معرّف الحساب أو الرابط يُستخدم للتنفيذ فقط؛ لا تدخل كلمة مرور الحساب في خانة المعرّف.\n\nيمكن للإدارة إخفاء الخدمة أثناء التعبئة أو الصيانة. يظهر عدم التوفر بصورتها الرمادية ورسالة قيد التعبئة. تفعيل الخدمة مجددًا لا يغيّر أسعار الطلبات المدفوعة المحفوظة.'),
 'deposits',jsonb_build_object('enabled',true,'ar',E'رصيد محفظتك مرجعه الدولار الأمريكي. لا يُضاف رصيد لمجرد تعبئة نموذج أو رفع إيصال.\n\nاختر طريقة إيداع مفعّلة، واقرأ تفاصيل الوجهة والتحويل. أدخل المبلغ بعملة التحويل وارفع صورة إيصال واضحة تخص العملية. تظهر القيمة المتوقع إضافتها بالدولار وفق سعر الصرف المعتمد لحظة تقديم الطلب.\n\nتراجع الإدارة صحة التحويل والوجهة والمبلغ. الطلب المقبول يضيف الرصيد مرة واحدة، والطلب المرفوض لا يضيف رصيدًا. تظهر الحالة وملاحظة المراجعة في سجل إيداعاتك. تحتفظ الطلبات المقدمة بسعر صرفها المحفوظ حتى لو عدّلته الإدارة لاحقًا.\n\nلا تكرر تقديم الإيصال نفسه، ولا تعتبر لقطة رسالة أو إثباتًا غير مكتمل تحويلًا معتمدًا. عند وجود فرق في قيمة التحويل أو العملة، تراجع الإدارة الطلب قبل الاعتماد.\n\nرسوم جهة التحويل وأي شروط خاصة بالطريقة ينبغي مراجعتها ضمن التعليمات قبل الإرسال. لطلب تسوية أو الاستفسار عن إيداع، استخدم رقم الطلب أو معرّف حسابك مع الدعم. ليست المحفظة حسابًا مصرفيًا، ولا يقدم الموقع ميزة سحب آلي من الرصيد.'),
 'resellers',jsonb_build_object('enabled',true,'ar',E'يحتاج ربط متجر خارجي إلى حساب تاجر تفعله الإدارة. التسجيل العادي لا يمنح صلاحية توزيع أو مفتاح وصول.\n\nيُنشأ المفتاح لحساب التاجر، وتُخصم مشترياته من محفظته بالدولار بعد اعتماد الإيداع. يجب حفظ المفتاح في خادم التاجر ومنع ظهوره في ملفات المتصفح أو تطبيقات العملاء. يمكن إلغاؤه وإنشاء بديل.\n\nاستخدم مرجعًا فريدًا لكل عملية شراء، واحفظ معرّف الطلب المسترجع. إرسال المرجع نفسه لا يكرر الخصم. تلتزم الطلبات بحدود الكمية والتوفر والرصيد، وتخضع للحد المعلن للطلبات في الدقيقة.\n\nتابع النتيجة من واجهة الحالة. لا تعِد إرسال الطلب الذي يحتاج مراجعة ما لم تؤكد الإدارة نتيجة المورّد. عالج فشل الاتصال باعتباره نتيجة غير مؤكدة، وليس دليلًا على فشل الطلب.\n\nيعرض دليل المبرمجين العمليات والاستجابات ونموذج الربط. أي اتفاق تجاري خاص أو مزوّد ببروتوكول مختلف يراجع مع الإدارة قبل التشغيل.'));
 -- Only add payment artwork drafts; no invented account numbers and no enabled methods.
 methods:=coalesce(cfg->'payment_methods','[]');
 IF jsonb_array_length(methods)=0 THEN methods:=jsonb_build_array(
  jsonb_build_object('id','bank-palestine','name_ar','بنك فلسطين','image_url','./assets/sections/payments.png','details_ar','','enabled',false),
  jsonb_build_object('id','reflect','name_ar','ريفلكت','image_url','./assets/sections/payments.png','details_ar','','enabled',false),
  jsonb_build_object('id','orange-money','name_ar','أورنج موني','image_url','./assets/sections/payments.png','details_ar','','enabled',false),
  jsonb_build_object('id','vodafone-cash','name_ar','فودافون كاش','image_url','./assets/sections/payments.png','details_ar','','enabled',false),
  jsonb_build_object('id','sham-cash','name_ar','شام كاش','image_url','./assets/sections/payments.png','details_ar','','enabled',false),
  jsonb_build_object('id','whish-money','name_ar','ويش موني','image_url','./assets/sections/payments.png','details_ar','','enabled',false));END IF;
 cfg:=(cfg-'name_en'-'footer_en'-'tagline_en'-'hero_title_en'-'hero_text_en')||jsonb_build_object('version',3,'pages',pages,'payment_methods',methods,'hero_image','./assets/sections/hero.png','policy_updated','١٢ أكتوبر ٢٠٢٦','allowed_origins',jsonb_build_array('https://f90-card-f90-card.vercel.app','https://f90-card.github.io'),'footer_ar','كل عالمك الرقمي في مكان واحد. محفظتك، طلباتك، وخدمات تُناسب عالمك.','app_icon_url','./f90-logo.png');
 UPDATE public.site_settings SET config=cfg,logo_url='./f90-logo.png',primary_color='#fa2444',updated_at=now() WHERE id=1;
END $$;
COMMIT;
