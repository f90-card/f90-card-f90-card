/* F90 CARD: stable two-design navigation.
 * Only fresh authoritative catalog settings may call apply(). A missing mode
 * never means "switch to current": it means retain the page already open.
 * This protects the historical HTML/CSS design without changing order logic. */
(function(root){
  "use strict";
  const KEY="f90-layout-redirect-guard-v3";
  const GRACE_MS=12000;
  const MAX_HOPS=2;
  function apply(config){
    const explicit=config && Object.prototype.hasOwnProperty.call(config,"ui_presentation_mode")
      ? config.ui_presentation_mode : null;
    if(explicit!=="classic" && explicit!=="current")return null;
    const selected=explicit;
    const isClassic=/\/classic\.html$/i.test(location.pathname);
    if((selected==="classic")===isClassic)return selected;
    const now=Date.now();
    try{
      const previous=JSON.parse(sessionStorage.getItem(KEY)||"null");
      const within=previous && Number.isFinite(previous.at) &&
        now>=previous.at && now-previous.at<GRACE_MS;
      const hops=within?Number(previous.hops||0):0;
      // Fail safely on the current document rather than bounce forever.
      if(hops>=MAX_HOPS){
        console.warn("F90 appearance: redirect cycle prevented");
        return selected;
      }
      sessionStorage.setItem(KEY,JSON.stringify({at:now,hops:hops+1}));
    }catch{/* Storage may be restricted; explicit server selection still works. */}
    const target=isClassic?"./index.html":"./classic.html";
    const url=new URL(target,location.href);
    url.search=location.search;
    url.hash=location.hash;
    location.replace(url.href);
    return selected;
  }
  root.F90LayoutMode=Object.freeze({apply});
})(window);
