/* Reference finance controls. Presentation only, not a second source of financial data. */
(function(){
  "use strict";
  const logo=()=>{
    const card=document.createElement("div");
    card.className="f90-logo-loading";
    card.setAttribute("role","status");
    card.setAttribute("aria-label","جارٍ تحميل الصفحة");
    const img=document.createElement("img");
    img.src="./f90-logo.png";img.alt="F90 CARD";img.width=94;img.height=94;
    const dots=document.createElement("span");dots.className="f90-loading-dots";dots.setAttribute("aria-hidden","true");
    for(let i=0;i<3;i++) dots.appendChild(document.createElement("i"));
    card.append(img,dots);
    return card;
  };
  let pending=false;
  function replaceFullPageLoading(){
    const main=document.getElementById("mainContent");
    if(!main)return;
    // Only full-page placeholders. Never replace a wallet row or transaction entry.
    for(const node of Array.from(main.children)){
      if(node.classList.contains("loading") && /جار|تحميل|تجهيز/.test(node.textContent||"")){
        node.replaceWith(logo());
      }
    }
  }
  const observer=new MutationObserver(()=>{
    if(pending)return;
    pending=true;
    queueMicrotask(()=>{pending=false;replaceFullPageLoading();});
  });
  function start(){
    const main=document.getElementById("mainContent");
    if(main){
      observer.observe(main,{childList:true,subtree:false});
      replaceFullPageLoading();
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  document.addEventListener("click",event=>{
    const btn=event.target.closest?.('[data-action="finance-apply-search"]');
    if(!btn)return;
    const scope=btn.closest(".f90-fin-tools");
    const input=scope?.querySelector('input[type="search"]');
    if(!input)return;
    input.dispatchEvent(new Event("input",{bubbles:true}));
    // Do not submit forms, change ledger records, or trigger any order actions.
    input.focus({preventScroll:true});
  });
})();
