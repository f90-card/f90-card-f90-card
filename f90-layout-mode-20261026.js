/* Global F90 storefront appearance switch.
 * Mode comes exclusively from the existing server-owned public catalog config.
 * Never changes product data, supplier calls, authentication or monetary values.
 * The historical mode restores the earlier styling layer but keeps current safe JS. */
(function(root){
 "use strict";
 const MODERN = new Set([
  "f90-reference-storefront.css",
  "f90-reference-corrections.css",
  "f90-checkout-service-fields.css",
  "f90-checkout-reference-final.css",
  "f90-reference-navigation-20261026.css",
  "f90-header-vip-cream-fix.css",
  "f90-finance-reference-20261026.css",
  "f90-sticky-cream-final-20261026.css",
  "f90-arabic-centered-header-20261026.css",
  "f90-header-balance-final-20261026.css",
  "f90-visual-consistency-20261026.css"
 ]);
 const html=document.documentElement;
 function apply(config){
   const mode=config?.ui_presentation_mode==="classic"?"classic":"current";
   html.dataset.f90Presentation=mode;
   const classic=mode==="classic";
   // Remove the modern cascade. The original stylesheets still load first.
   html.classList.toggle("f90-reference-theme",!classic);
   html.classList.toggle("f90-global-frame-on",!classic);
   for(const link of document.querySelectorAll('link[rel="stylesheet"]')){
     try{
       const name=new URL(link.href,document.baseURI).pathname.split("/").pop();
       if(MODERN.has(name))link.disabled=classic;
     }catch{}
   }
   const actions=document.querySelector(".site-header .header-actions");
   const left=document.getElementById("f90HeaderLeft");
   const wallet=document.getElementById("headerWallet");
   if(classic){
     if(actions&&wallet&&wallet.parentElement!==actions)actions.prepend(wallet);
     document.getElementById("f90ReferenceBack")?.setAttribute("hidden","");
     // Classic styling uses the previous header flow, not the modern 3-column grid.
   }else{
     if(left&&wallet&&wallet.parentElement!==left)left.prepend(wallet);
   }
   return mode;
 }
 root.F90LayoutMode=Object.freeze({apply});
})(window);
