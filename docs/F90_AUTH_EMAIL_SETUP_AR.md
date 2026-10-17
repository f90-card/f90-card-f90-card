# إعداد رسائل الدخول واستعادة الحساب | F90 CARD

العنوان الرسمي: https://www.f90card.online/

## 1. روابط Supabase Auth
من لوحة Supabase: Authentication > URL Configuration:
- Site URL = `https://www.f90card.online`
- Redirect URLs: `https://www.f90card.online/**` و`https://f90card.online/**`
- اترك الروابط القديمة مسموحة مؤقتًا لاستعادة الجلسات ورسائل البريد السابقة.
- لا تضع مفاتيح أو كلمات مرور هنا أو في GitHub.

## 2. Google OAuth
Supabase: Authentication > Providers > Google: تأكد أن Google provider مفعّل.
Google Cloud Console OAuth Authorized redirect URI هو
`https://xzqnrpycjxfbyrfaolud.supabase.co/auth/v1/callback`
وليس صفحة `/#/auth` أو `/admin.html`.
يحوّل تطبيق F90 إلى `https://www.f90card.online/` بعد المصادقة.
لا تنشر Google OAuth Client Secret أو SMTP Password.

## 3. البريد الاحترافي لاستعادة كلمة المرور
تحتاج مزوّد إرسال بريد SMTP يسمح بالتحقق من ملكية `f90card.online`،
مثل Resend / Brevo أو خدمة بريد تدعم SMTP. أنشئ هوية إرسال
`security@f90card.online` (لا تعتبر العنوان مُنشأ أو قادرًا على استقبال رسائل قبل تهيئته).
أضف سجلات SPF وDKIM وDMARC بالقيم الدقيقة التي يقدمها المزود في Spaceship DNS،
ولا تستبدل سجلّي A وCNAME الحاليين. DMARC يجب تهيئته حسب المزود، وليس بقيم مخترعة.
بعد التوثيق، ضع بيانات SMTP في Supabase > Project Settings / Authentication > SMTP Settings
حسب واجهة حسابك، مع Sender name = F90 CARD | أف تسعين كارد.
لا تضع SMTP Username أو Password في GitHub أو المحادثة.

## 4. القوالب
Supabase > Authentication > Email Templates > Reset password:
- Subject: `استعادة كلمة مرور حسابك | F90 CARD`
- انسخ HTML من `docs/email-templates/password-recovery-ar.html`.
- استخدم `{{ .ConfirmationURL }}` كما هي؛ Supabase تولّد الرابط الآمن.
- جرّب الإرسال إلى عنوان حساب تجريبي تملكه فقط بعد توثيق SMTP والتفعيل.

## 5. التحقق الآمن
- افتح المتجر ودخول Google من حساب تجريبي؛ التأكد من العودة إلى www.
- أرسل استعادة كلمة مرور إلى بريد تجريبي مملوك لك فقط؛ التأكد من ظهور `#/reset` بعد الضغط.
- تأكد من تسجيل الدخول بعد التغيير، وعدم كشف أي بيانات حساسة في الرابط المشارك.
- صفحة الإدارة تبقى محمية بصلاحيات المدير وMFA؛ الرابط `admin.html#/media-center` مجرد مسار عرض.

**الحالة:** ملفات الإعداد والقوالب جاهزة للنسخ؛ تغييرات Auth URL وSMTP تحتاج حفظها في لوحة Supabase والتحقق من خدمة الإرسال، وهي ليست مفعّلة تلقائيًا بمجرد نشر القالب.
