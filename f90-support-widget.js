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
let lastIntent="";
const normalize=t=>String(t||"").toLowerCase().normalize("NFKC").replace(/[\u064b-\u065f\u0670]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").trim();
const intents=[
 {id:"deposit",keys:["ايداع","اشحن رصيدي","اضافه رصيد","تحويل","عموله","رسوم","ايصال","محفظه"],reply:topics[1][1]},
 {id:"orders",keys:["طلب","طلباتي","تتبع","وين طلبي","قيد التنفيذ","قيد التعبئه","لم يصل","ما وصل"],reply:topics[2][1]},
 {id:"buy",keys:["شراء","اشتري","شحن لعبه","خدمه","سعر","كيف اشحن","اشتراك"],reply:topics[0][1]},
 {id:"verify",keys:["توثيق","تحقق","هويه","تفعيل حساب"],reply:topics[3][1]},
 {id:"vip",keys:["vip","خصم","مستوى","رتبه"],reply:topics[4][1]},
 {id:"install",keys:["تثبيت","تطبيق المتجر","اضافه للشاشه"],reply:topics[5][1]},
 {id:"channel",keys:["قناه","اخبار","تحديثات","عروض","واتساب القناه"],reply:"قناة واتساب مخصصة لأخبار F90 CARD وتحديثات الخدمات والأسعار. رابطها موجود أسفل المحادثة. أما مساعدة طلباتك فهي لدى خدمة العملاء، وليست في القناة."},
 {id:"human",keys:["موظف","خدمه العملاء","بشري","دعم فني","تواصل","شكوى","مشكله بحسابي"],reply:"يمكنك التواصل مباشرةً مع خدمة العملاء عبر الرابط أسفل المحادثة. لا تكتب كلمة مرورك أو رمز التحقق أو بيانات الدفع هنا."}
];
function answer(t){
 const q=normalize(t);
 if(!q)return "اكتب سؤالك وسأحاول مساعدتك.";
 if(/^(اهلا|مرحبا|السلام عليكم|هلا|هاي|صباح الخير|مساء الخير)/.test(q))return "أهلاً بك في أف تسعين كارد! كيف أقدر أساعدك اليوم؟ يمكنك السؤال بحرية عن الطلبات، الشراء، الإيداع أو أخبار المتجر.";
 if(/شكرا|يسلمو|مشكور/.test(q))return "العفو، يسعدني مساعدتك. إذا احتجت متابعة خاصة بطلبك فخدمة العملاء متاحة من الرابط أدناه.";
 if(/من انت|اسمك|مين انت/.test(q))return "أنا مساعد أف تسعين كارد الآلي. أشرح خدمات المتجر وأرشدك للصفحة الصحيحة، لكن لا أملك صلاحية قراءة حسابك أو تنفيذ الطلبات.";
 const matches=intents.map(x=>({intent:x,score:x.keys.reduce((n,k)=>n+(q.includes(normalize(k))?k.length>=5?3:2:0),0)})).sort((a,b)=>b.score-a.score);
 const hit=matches[0].score?matches[0].intent:null;
 if(hit){lastIntent=hit.id;return hit.reply;}
 if(/^(طيب|تمام|وبعدين|كيف|وين|شو اعمل|يعني|وضح|ممكن|ليش)/.test(q)&&lastIntent){
  const prior=intents.find(x=>x.id===lastIntent);
  if(prior)return "بخصوص سؤالك السابق: "+prior.reply+" إذا كان الأمر متعلقاً بعملية محددة، تواصل مع خدمة العملاء ليتحققوا منها.";
 }
 if(/كم|متى|متوفر|سعر/.test(q))return "الأسعار والتوفر قد يتغيران. افتح الخدمة المطلوبة داخل المتجر لمشاهدة السعر والحالة الحالية. لا يمكنني تأكيد سعر أو موعد تنفيذ دون بيانات النظام المباشرة.";
 return "فهمت سؤالك، لكن لا أملك معلومة مؤكدة عنه الآن. اكتب اسم الخدمة أو وضّح المشكلة، أو استخدم زر خدمة العملاء للمساعدة الشخصية. قناة واتساب مخصصة للإعلانات والتحديثات.";
}
function render(){const l=links();root.innerHTML='<button class="f90-help-fab" type="button" aria-label="'+(open?'إغلاق مساعد F90 CARD':'فتح مساعد F90 CARD')+'" aria-expanded="'+open+'">✦ <span>مساعدة</span></button><section class="f90-help-panel" role="dialog" aria-label="مساعد أف تسعين كارد" '+(open?'':'hidden')+'><header><div><strong>مساعد أف تسعين كارد</strong><small>إجابات فورية عن خدمات المتجر</small></div><button type="button" class="f90-help-close" aria-label="إغلاق المساعد">×</button></header><div class="f90-help-messages" aria-live="polite"><p class="f90-help-bot">مرحباً بك! أنا المساعد الآلي لمتجر F90 CARD. اختر موضوعاً أو اكتب سؤالك. لا أستطيع الاطلاع على طلبك الخاص أو اعتماد المدفوعات.</p></div><div class="f90-help-topics">'+topics.map(([name])=>'<button type="button" data-topic="'+esc(name)+'">'+esc(name)+'</button>').join("")+'</div><form class="f90-help-question"><label class="sr-only" for="f90HelpInput">اكتب سؤالك</label><input id="f90HelpInput" maxlength="300" placeholder="كيف يمكنني مساعدتك؟" required><button type="submit">إرسال</button></form><footer>'+(l.support?'<a href="'+esc(l.support)+'" target="_blank" rel="noopener noreferrer">تحدث مع خدمة العملاء ↗</a>':'<a href="#/support">خدمة العملاء داخل الموقع</a>')+(l.channel?'<a href="'+esc(l.channel)+'" target="_blank" rel="noopener noreferrer">تابع أخبارنا على قناة واتساب ↗</a>':'')+'</footer></section>';
 root.querySelector(".f90-help-fab").onclick=()=>{open=!open;render();if(open)root.querySelector("input")?.focus();};
 root.querySelector(".f90-help-close").onclick=()=>{open=false;render();};
 const send=t=>{const box=root.querySelector(".f90-help-messages");const p=document.createElement("p");p.className="f90-help-user";p.textContent=t;box.append(p);const a=document.createElement("p");a.className="f90-help-bot";a.textContent=answer(t);box.append(a);box.scrollTop=box.scrollHeight;};
 root.querySelectorAll("[data-topic]").forEach(b=>b.onclick=()=>send(b.dataset.topic));
 root.querySelector("form").onsubmit=e=>{e.preventDefault();const input=root.querySelector("input");if(input.value.trim())send(input.value.trim());input.value="";};
}
window.F90Support={configure:c=>{settings=c||{};render();}};render();
})();