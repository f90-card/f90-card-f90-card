/* F90 support assistant: local FAQ; not a live human or generative AI. */
(()=>{"use strict";
const root=document.getElementById("f90SupportWidget");if(!root)return;
let settings={},open=false;
const esc=v=>String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function links(){
 const number=String(settings.whatsapp||"").replace(/\D/g,"");
 const channel=String(settings.whatsapp_channel_url||"");
 return {support:number.length>=8?"https://wa.me/"+number+"?text="+encodeURIComponent("مرحباً، أحتاج مساعدة في متجر F90 CARD"):null,channel:/^https:\/\/whatsapp\.com\/channel\/[a-zA-Z0-9]+\/?(?:\?.*)?$/.test(channel)?channel:null};
}
const topics=[
 ["الشراء","اختر الخدمة من أقسام المتجر، أدخل بيانات الحساب، راجع السعر والرصيد، ثم اضغط «شراء الآن». يمكنك متابعة النتيجة من سجل الطلبات."],
 ["الإيداع","افتح المحفظة ثم إضافة رصيد، واختر وسيلة الدفع وارفع الإيصال. تُخصم عمولة إيداع 2٪ من المبلغ المحوّل ويُضاف الصافي فقط بعد موافقة الإدارة."],
 ["الطلبات","لمتابعة حالة طلبك افتح «طلباتي» في حسابك. الخدمات قيد التعبئة لا تقبل طلبات جديدة حتى عودتها."],
 ["التوثيق","يجب توثيق الحساب واعتماده قبل الإيداع والشراء. افتح «توثيق الحساب» من ملفك الشخصي."],
 ["VIP","تظهر رتبتك ومزاياك من «مستوى VIP» داخل ملفك الشخصي. قيمة الخصم النهائية يحددها النظام عند عرض السعر."],
 ["التثبيت","يمكنك فتح «تثبيت التطبيق» من القائمة واتباع تعليمات الجهاز إذا كان التثبيت متاحاً."]
];
function answer(t){const s=t.trim().toLowerCase();const match=topics.find(([name])=>s.includes(name.toLowerCase()))||
 (/رصيد|محفظة/.test(s)?topics[1]:/سعر|منتج|شحن/.test(s)?topics[0]:/حالة|تتبع/.test(s)?topics[2]:null);
 return match?match[1]:"أستطيع مساعدتك في الشراء والإيداع والطلبات والتوثيق وVIP وتثبيت التطبيق. للمسائل الخاصة بحسابك تواصل مع الدعم البشري، ولا ترسل كلمة مرورك أو رمز التحقق.";
}
function render(){const l=links();root.innerHTML='<button class="f90-help-fab" type="button" aria-label="فتح مساعد F90 CARD" aria-expanded="'+open+'">✦ <span>مساعدة</span></button><section class="f90-help-panel" role="dialog" aria-label="مساعد أف تسعين كارد" '+(open?'':'hidden')+'><header><div><strong>مساعد أف تسعين كارد</strong><small>إجابات فورية عن خدمات المتجر</small></div><button type="button" class="f90-help-close" aria-label="إغلاق المساعد">×</button></header><div class="f90-help-messages" aria-live="polite"><p class="f90-help-bot">مرحباً بك! أنا المساعد الآلي لمتجر F90 CARD. اختر موضوعاً أو اكتب سؤالك. لا أستطيع الاطلاع على طلبك الخاص أو اعتماد المدفوعات.</p></div><div class="f90-help-topics">'+topics.map(([name])=>'<button type="button" data-topic="'+esc(name)+'">'+esc(name)+'</button>').join("")+'</div><form class="f90-help-question"><label class="sr-only" for="f90HelpInput">اكتب سؤالك</label><input id="f90HelpInput" maxlength="300" placeholder="كيف يمكنني مساعدتك؟" required><button type="submit">إرسال</button></form><footer>'+(l.support?'<a href="'+esc(l.support)+'" target="_blank" rel="noopener noreferrer">تحدث مع خدمة العملاء ↗</a>':'<a href="#/support">خدمة العملاء داخل الموقع</a>')+(l.channel?'<a href="'+esc(l.channel)+'" target="_blank" rel="noopener noreferrer">تابع أخبارنا على قناة واتساب ↗</a>':'')+'</footer></section>';
 root.querySelector(".f90-help-fab").onclick=()=>{open=!open;render();if(open)root.querySelector("input")?.focus();};
 root.querySelector(".f90-help-close").onclick=()=>{open=false;render();};
 const send=t=>{const box=root.querySelector(".f90-help-messages");const p=document.createElement("p");p.className="f90-help-user";p.textContent=t;box.append(p);const a=document.createElement("p");a.className="f90-help-bot";a.textContent=answer(t);box.append(a);box.scrollTop=box.scrollHeight;};
 root.querySelectorAll("[data-topic]").forEach(b=>b.onclick=()=>send(b.dataset.topic));
 root.querySelector("form").onsubmit=e=>{e.preventDefault();const input=root.querySelector("input");if(input.value.trim())send(input.value.trim());input.value="";};
}
window.F90Support={configure:c=>{settings=c||{};render();}};render();
})();