/* Screenshot-reference storefront enhancements.
   Presentational DOM additions only; F90 quote, order and auth handlers remain authoritative. */
(function(){
  "use strict";
  const main=document.getElementById("mainContent");
  if(!main)return;
  let scheduled=false;
  function upgradeHome(){
    if(main.dataset.page!=="home"||main.querySelector("#f90RefHomeSearch"))return;
    const anchor=main.querySelector(".section-head")||main.querySelector(".image-grid");
    if(!anchor)return;
    const form=document.createElement("form");
    form.id="f90RefHomeSearch";
    form.className="f90-reference-search";
    form.setAttribute("role","search");
    form.innerHTML='<input type="search" name="q" autocomplete="off" aria-label="بحث عن الخدمات" placeholder="بحث" required><button type="submit" aria-label="بحث">⌕</button>';
    form.addEventListener("submit",event=>{
      event.preventDefault();
      const value=form.elements.q.value.trim();
      if(!value)return;
      location.hash="#/search/"+encodeURIComponent(value);
    });
    anchor.insertAdjacentElement("beforebegin",form);
  }
  function upgradeProfile(){
    if(main.dataset.page!=="profile")return;
    const form=main.querySelector("#profileForm");
    if(!form||form.dataset.referenceEnhanced==="1")return;
    const full=form.elements.namedItem("display_name");
    if(!full)return;
    form.dataset.referenceEnhanced="1";
    const original=full.closest(".field");
    if(original)original.classList.add("f90-reference-original-name");
    const chunks=String(full.value||"").trim().split(/\s+/);
    const first=chunks.shift()||"",last=chunks.join(" ");
    const names=document.createElement("div");
    names.className="f90-reference-name-fields";
    names.innerHTML='<label class="field"><span>الاسم الأول</span><input type="text" id="f90ReferenceFirstName" required maxlength="100" autocomplete="given-name"></label><label class="field"><span>الاسم الأخير</span><input type="text" id="f90ReferenceLastName" maxlength="100" autocomplete="family-name"></label>';
    names.querySelector("#f90ReferenceFirstName").value=first;
    names.querySelector("#f90ReferenceLastName").value=last;
    original?.insertAdjacentElement("beforebegin",names);
    function sync(){full.value=[names.querySelector("#f90ReferenceFirstName").value.trim(),names.querySelector("#f90ReferenceLastName").value.trim()].filter(Boolean).join(" ");}
    names.addEventListener("input",sync);
    form.addEventListener("submit",sync,true);
    // The screenshot uses an editable camera badge over the profile avatar.
    // Keep the native file input bound to profileForm, so existing upload logic works.
    const avatarInput=form.elements.namedItem("avatar");
    const avatarField=avatarInput?.closest(".field");
    const cover=main.querySelector(".profile-cover");
    if(avatarField&&cover){
      avatarInput.setAttribute("form","profileForm");
      avatarField.classList.add("f90-reference-avatar-upload");
      const label=avatarField.querySelector("span");
      if(label){label.textContent="📷";label.setAttribute("aria-label","تغيير صورة الحساب");}
      cover.appendChild(avatarField);
    }

  }
  function cancelDirectCheckout(event){
    const control=event.target.closest?.(".f90-reference-cancel");
    if(!control)return;
    const panel=document.getElementById("quickProductPanel");
    if(panel&&!panel.hidden)return;
    event.preventDefault();
    location.hash="#/";
  }
  function upgrade(){
    scheduled=false;
    upgradeHome();
    upgradeProfile();
  }
  const observer=new MutationObserver(records=>{
    if(scheduled)return;
    // Observe new content only, not each individual price/translation update.
    if(!records.some(r=>r.type==="childList"&&r.addedNodes.length))return;
    scheduled=true;
    requestAnimationFrame(upgrade);
  });
  observer.observe(main,{childList:true,subtree:false});
  document.addEventListener("click",cancelDirectCheckout,true);
  document.addEventListener("DOMContentLoaded",upgrade,{once:true});
  window.addEventListener("hashchange",()=>requestAnimationFrame(upgrade));
  upgrade();
})();