/* Service-aware checkout presentation. Never changes supplier field IDs or order payloads. */
(function(root){
  "use strict";
  const norm = value=>String(value??"").replace(/[٠-٩]/g,ch=>String(ch.charCodeAt(0)-0x660))
    .replace(/[۰-۹]/g,ch=>String(ch.charCodeAt(0)-0x6f0)).replace(/\u066B/g,".").replace(/\u066C/g,"");
  function normalizeQuantity(value){
    const raw=norm(value).trim().replace(/[\u200c\u200d\u200e\u200f\s]/g,"");
    // Only unambiguous group commas are thousands separators.
    return raw.replace(/(\d),(?=\d{3}(?:,|\.|$))/g,"$1").replace(/,/g,".");
  }
  function validateQuantity(value,commerce){
    const raw=normalizeQuantity(value);
    const minimum=Number(commerce?.quantity_min??1);
    const maximum=Number(commerce?.quantity_max??1000000000);
    const step=Number(commerce?.quantity_step??1);
    if(raw===""||!/^\d+(?:\.\d+)?$/.test(raw))return {valid:false,quantity:null,message:"أدخل كمية رقمية صحيحة"};
    const quantity=Number(raw);
    if(!Number.isFinite(quantity)||quantity>Number.MAX_SAFE_INTEGER)
      return {valid:false,quantity:null,message:"الكمية أكبر من الحد المسموح"};
    if(quantity<minimum||quantity>maximum)
      return {valid:false,quantity,message:"الكمية يجب أن تكون بين "+minimum.toLocaleString("en-US")+" و"+maximum.toLocaleString("en-US")};
    if(!(step>0&&Number.isFinite(step)))
      return {valid:false,quantity,message:"إعداد كمية الخدمة غير صحيح"};
    const multiples=(quantity-minimum)/step;
    if(Math.abs(multiples-Math.round(multiples))>1e-7)
      return {valid:false,quantity,message:"الكمية يجب أن تزيد بمضاعفات "+step};
    return {valid:true,quantity,message:""};
  }
  function fieldMeta(field){
    const raw=String(field?.label_ar||field?.label||field?.id||"").trim().replace(/\s+/g," ");
    const key=String(field?.id||"").toLowerCase();
    const text=(raw+" "+key).toLowerCase();
    let label=raw||"معلومات الحساب", hint="", mode="text", type="text";
    if(/هاتف|جوال|phone|mobile/.test(text)&&/بريد|إلكتروني|الكتروني|ايميل|email/.test(text)){
      label="رقم الهاتف أو البريد الإلكتروني";hint="أدخل رقم الهاتف أو البريد حسب متطلبات الخدمة";
    }else if(/رقم الحساب/.test(text)&&/هاتف|رقم عاتف|جوال/.test(text)){
      label="رقم الحساب أو رقم الهاتف";hint="أدخل رقم الحساب أو الهاتف المطلوب";
    }else if(field?.type==="email"||/بريد|ايميل|إيميل|اليميل|email|e.mail/.test(text)){
      label="البريد الإلكتروني";hint="أدخل البريد الإلكتروني المرتبط بالخدمة";mode="email";type="email";
    }else if(/سيرفر|server|zone.id/.test(text)){
      label="رقم السيرفر";hint="أدخل رقم السيرفر كما يظهر داخل اللعبة";mode="text";
    }else if(/آيبان|ايبان|iban/.test(text)){
      label=/رقم الحساب|account/.test(text)?"رقم الحساب أو الآيبان":"رقم الآيبان";
      hint="أدخل بيانات الحساب المستفيد كما هي";mode="text";
    }else if(/مستفيد|المستلم|recipient_name/.test(text)){
      label="اسم المستفيد";hint="اكتب اسم المستفيد كما هو مسجل";mode="text";
    }else if(/هاتف|جوال|موبايل|واتساب|whatsapp|contact_phone|phone|mobile/.test(text)){
      label=/واتساب/.test(text)&&/هاتف|رقم/.test(text)?"رقم الهاتف أو واتساب":"رقم الهاتف";
      if(/شحنه|المطلوب شحنه/.test(text))label="رقم الهاتف المراد شحنه";
      hint="أدخل رقم الهاتف مع رمز الدولة عند الحاجة";mode="tel";type="tel";
    }else if(/رابط|لينك|link|url/.test(text)){
      label=/منشور|بوست/.test(text)?"رابط المنشور":/قناة/.test(text)?"رابط القناة":/حساب/.test(text)?"رابط الحساب":"الرابط المطلوب";
      if(/معرف|معرّف|ايد[يى]|آيدي/.test(text))label="رابط الحساب أو معرّف الحساب";
      hint="الصق الرابط المطلوب بشكل كامل";mode="url";
    }else if(/كلمة\s*السر|كلمت\s*السر|password/.test(text)){
      label="كلمة المرور المطلوبة للخدمة";hint="لا تدخل كلمة مرور حساب المتجر";type="password";
    }else if(/اسم\s*(?:ال)?مستخدم|إسم\s*(?:ال)?مستخدم|الاسم\s*(?:ال)?مستخدم|nickname/.test(text)){
      label="اسم المستخدم";hint="اكتب اسم المستخدم كما يظهر في التطبيق";
    }else if(/اللاعب|الاعب|للاعب|للاعب|player/.test(text)&&/ايد|آيد|معرف|معرّف|uid|id/.test(text)){
      label="آيدي اللاعب";hint="أدخل آيدي اللاعب كما يظهر داخل اللعبة";
    }else if(/ايد|آيد|معرف|معرّف|(^id$)|uid/.test(text)){
      label=/حساب/.test(text)?"آيدي الحساب":"آيدي المستخدم";
      hint="أدخل المعرّف الصحيح دون مسافات إضافية";
    }else if(/كود\s*التحويل|رمز\s*التحويل|code/.test(text)){
      label="كود التحويل";hint="أدخل كود التحويل المطلوب";
    }else if(/رقم\s*التحويل/.test(text)){
      label="رقم التحويل";hint="أدخل مرجع التحويل الصحيح";
      if(/حساب/.test(text))label="رقم التحويل أو رقم الحساب";
    }else if(/محفظة|محفضة|wallet/.test(text)){
      label=/اسم/.test(text)?"اسم المحفظة":"رقم المحفظة";
      if(/كليك|click/.test(text))label="اسم المحفظة أو كليك";
      if(/رمز/.test(text))label="رمز المحفظة";
      hint="أدخل بيانات المحفظة المطلوبة";
    }else if(/اسم\s*البنك/.test(text)){
      label="اسم البنك";hint="أدخل اسم البنك المعني";
    }else{
      label=raw.replace(/^(?:يرجى|يرجا|يرجئ)\s*/,"")
        .replace(/^(?:ادخل|أدخل|إدخل|اسادخل)\s*/,"").trim()||"بيانات الطلب";
      hint="أدخل "+label+" بدقة";
    }
    if(/(?:^|\s)(?:2|٢)$/.test(raw)&&!/(?:2|٢)$/.test(label))label+=" 2";
    // The supplier controls the field id and mandatory flag; UI only clarifies its label.
    if(field?.type==="textarea")type="textarea";
    else if(field?.type==="url")type="url";
    return {id:String(field?.id||""),label,hint,inputType:type,inputMode:mode,
      required:field?.required!==false};
  }
  function isBoilerplate(description){
    return !String(description||"").trim() || /^أف تسعين كارد\s*[·|\-]\s*/.test(String(description).trim());
  }
  function instructions(product,commerce,fields,quantityVisible){
    const title=String(product?.name||"الخدمة").trim();
    const description=String(product?.description||"").trim();
    const original=isBoilerplate(description)?"":description;
    const fulfillment=commerce?.fulfillment==="automatic"?"automatic":commerce?.fulfillment==="manual"?"manual":"unknown";
    const automatic=fulfillment==="automatic";
    const manual=fulfillment==="manual";
    // These are user-provided estimates, not server-side execution guarantees.
    const timing=automatic?"من 5 إلى 60 ثانية":manual?"من 5 إلى 120 دقيقة":"حسب نوع الخدمة";
    const required=fields.filter(f=>f.required).map(f=>f.label);
    const details=[
      ...(original?[original]:[]),
      ...(required.length?["البيانات المطلوبة: "+required.join("، ")+"."]:[]),
      ...(quantityVisible?["اختر العدد المناسب ضمن الحد المسموح للخدمة."]:[]),
    ];
    return {
      header:automatic?"💎 شحن تلقائي سريع":manual?"🕘 تنفيذ يدوي للطلب":"💎 تفاصيل تنفيذ الطلب",
      timing,
      timingLabel:automatic?"⚡ المدة المتوقعة من 5 إلى 60 ثانية":manual?"⏰ المدة المتوقعة من 5 إلى 120 دقيقة":"⏰ مدة التنفيذ حسب الخدمة",
      note:"🚨 راجع صحة بياناتك قبل الشراء. يمكنك متابعة حالة التنفيذ من سجل الطلبات.",
      details,
      fulfillment,
      title
    };
  }

  root.F90CheckoutPresentation={fieldMeta,instructions,normalizeQuantity,validateQuantity};
})(typeof window!=="undefined"?window:globalThis);
