/* Two fully separate presentation documents. Modern storefront is never restyled
 * when selected; the 2026-10-24 original HTML and exact old CSS snapshot are
 * served independently from classic.html. Both run the CURRENT trusted app
 * and API code, so switching appearance never rolls financial or auth logic back. */
(function(root){
 "use strict";
 function apply(config){
   const selected=config?.ui_presentation_mode==="classic"?"classic":"current";
   const isClassic=/\/classic\.html$/i.test(location.pathname);
   if((selected==="classic")!==isClassic){
     const target=isClassic?"./index.html":"./classic.html";
     const url=new URL(target,location.href);
     url.search=location.search;
     url.hash=location.hash;
     location.replace(url.href);
   }
   return selected;
 }
 root.F90LayoutMode=Object.freeze({apply});
})(window);
