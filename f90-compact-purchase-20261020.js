/* F90 compact quantity controls. Existing quote API remains authoritative. */
(function(){
"use strict";
function attach(){
 const form=document.getElementById("checkoutForm");
 if(!form || form.dataset.f90QtyButtons==="1")return;
 const input=form.elements.namedItem("quantity");
 if(!input || input.type==="hidden")return;
 const row=input.closest(".f90-visa-inputrow");
 if(!row)return;
 form.dataset.f90QtyButtons="1";
 [["minus","−",-1],["plus","+",1]].forEach(function(spec){
 const button=document.createElement("button");
 button.type="button";button.className="f90-qty-button f90-qty-"+spec[0];
 button.textContent=spec[1];button.setAttribute("aria-label",spec[2]>0?"زيادة الكمية":"تقليل الكمية");
 button.addEventListener("click",function(){
   const step=Number(input.step)||1,min=Number(input.min)||1,max=Number(input.max)||1e9;
   let current=Number(input.value);if(!Number.isFinite(current))current=min;
   const next=Math.min(max,Math.max(min,current+spec[2]*step));
   if(next===current)return;
   input.value=String(Number(next.toFixed(8)));
   input.dispatchEvent(new Event("input",{bubbles:true}));
 });
 row.appendChild(button);
 });
}
document.addEventListener("DOMContentLoaded",function(){
 attach();
 const root=document.getElementById("mainContent");
 if(root)new MutationObserver(attach).observe(root,{childList:true,subtree:true});
 const quick=document.getElementById("quickProductPanel");
 if(quick)new MutationObserver(attach).observe(quick,{childList:true,subtree:true});
 document.addEventListener("click",function(){queueMicrotask(attach)},true);
});
})();
