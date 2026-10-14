/* F90 Quran: separate reading area, no store content. */
(() => {
  "use strict";
  const names = "الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس".split("|");
  let requestId = 0;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const normal = (v) => String(v||"").normalize("NFKC").replace(/[\u064b-\u065f\u0670]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").toLowerCase();
  function render(main) {
    requestId++;
    main.innerHTML = `<div class="f90-quran" dir="rtl"><header class="f90-quran-hero"><span class="f90-quran-eyebrow">ركن القرآن الكريم</span><h1>القرآن الكريم</h1><p>مساحة هادئة لقراءة آيات القرآن الكريم، بعيدًا عن خدمات المتجر والإعلانات.</p><div class="f90-quran-ornament" aria-hidden="true">۞</div></header><section class="f90-quran-body"><div class="f90-quran-heading"><h2>فهرس السور</h2><p>اختر سورة لقراءتها داخل الصفحة</p></div><label class="f90-quran-search-label" for="f90QuranSearch">البحث عن سورة</label><input id="f90QuranSearch" type="search" placeholder="اسم السورة أو رقمها" autocomplete="off"><div class="f90-quran-grid" id="f90QuranGrid">${names.map((name,i)=>`<button class="f90-quran-surah" type="button" data-surah="${i+1}"><span class="f90-quran-number">${i+1}</span><strong>سورة ${esc(name)}</strong><span class="f90-quran-open">قراءة ←</span></button>`).join("")}</div><p id="f90QuranEmpty" hidden>لم نجد سورة بهذا الاسم.</p></section><section class="f90-quran-reader" id="f90QuranReader" hidden aria-live="polite"><div class="f90-quran-reader-head"><div><span class="f90-quran-eyebrow">قراءة القرآن</span><h2 id="f90QuranTitle"></h2></div><button type="button" id="f90QuranBack">العودة للفهرس</button></div><div id="f90QuranVerses" class="f90-quran-verses"></div><p class="f90-quran-source">يتم تحميل نص الآيات من مصدر قرآني خارجي. عند تعذر الاتصال يمكن فتح السورة من المصدر البديل.</p><a id="f90QuranExternal" href="https://quran.com" target="_blank" rel="noopener noreferrer">فتح السورة على Quran.com ↗</a></section></div>`;
    const grid=main.querySelector("#f90QuranGrid");
    const input=main.querySelector("#f90QuranSearch");
    input.addEventListener("input",()=>{
      const term=normal(input.value.trim());
      let shown=0;
      grid.querySelectorAll("[data-surah]").forEach((button)=>{
        const i=Number(button.dataset.surah);
        const visible=!term||normal(names[i-1]).includes(term)||String(i)===term;
        button.hidden=!visible;
        if(visible)shown++;
      });
      main.querySelector("#f90QuranEmpty").hidden=shown!==0;
    });
    grid.addEventListener("click",(ev)=>{
      const btn=ev.target.closest("[data-surah]");
      if(!btn)return;
      openSurah(main,Number(btn.dataset.surah));
    });
    main.querySelector("#f90QuranBack").addEventListener("click",()=>{
      requestId++;
      main.querySelector("#f90QuranReader").hidden=true;
      main.querySelector(".f90-quran-body").hidden=false;
      main.querySelector(".f90-quran-body").scrollIntoView({behavior:"smooth",block:"start"});
    });
  }
  async function openSurah(main,n){
    if(!Number.isInteger(n)||n<1||n>114)return;
    const token=++requestId;
    const reader=main.querySelector("#f90QuranReader");
    main.querySelector(".f90-quran-body").hidden=true;
    reader.hidden=false;
    main.querySelector("#f90QuranTitle").textContent="سورة "+names[n-1];
    const target=main.querySelector("#f90QuranVerses");
    target.textContent="جارٍ تحميل الآيات…";
    main.querySelector("#f90QuranExternal").href="https://quran.com/"+n;
    reader.scrollIntoView({behavior:"smooth",block:"start"});
    try{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),12000);
      let response;
      try{response=await fetch("https://api.alquran.cloud/v1/surah/"+n,{signal:controller.signal,headers:{"Accept":"application/json"}});}
      finally{clearTimeout(timeout);}
      if(!response.ok)throw Error("تعذر الاتصال");
      const payload=await response.json();
      if(token!==requestId||!reader.isConnected)return;
      const ayahs=payload?.data?.ayahs;
      if(!Array.isArray(ayahs)||!ayahs.length)throw Error("لا توجد آيات");
      target.innerHTML=ayahs.map(a=>`<span class="f90-quran-ayah">${esc(a.text)} <b class="f90-quran-verse-num">۞ ${esc(a.numberInSurah)}</b></span>`).join(" ");
    }catch(err){
      if(token!==requestId||!reader.isConnected)return;
      target.innerHTML='<p class="f90-quran-error">تعذر تحميل الآيات حاليًا. يمكنك قراءة السورة عبر الرابط أدناه.</p>';
    }
  }
  window.F90Quran={render};
})();
