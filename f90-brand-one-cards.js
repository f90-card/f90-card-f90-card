(function (root) {
  "use strict";
  const finite = (v, fallback, min, max) => Number.isFinite(Number(v)) && Number(v)>=min && Number(v)<=max ? Number(v) : fallback;
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function isCategory(item) { return String(item?.slug || "").startsWith("f90-brand-one-"); }
  function isProduct(item) { return item?.commerce?.supplier_catalog === "brand_one"; }
  function meta(item, kind) { return (kind === "category" ? item.presentation : item.commerce)?.supplier_card || {}; }
  function style(item, kind) {
    return "--bc-ratio:1;--bc-radius:50%;--bc-fit:contain;--bc-image-pct:100%;--bc-width:100%;--bc-height:100%";
  }
  function gridStyle(category) {
    const display=category?.presentation?.supplier_card?.display || {};
    const mobile=display.webMobile?.contents || {}, desktop=display.webDesktop?.contents || {};
    return `--bc-phone-cols:${finite(mobile.columns,3,1,6)};--bc-desktop-cols:${finite(desktop.columns,5,1,8)}`;
  }
  function render(item, kind, options) {
    const e=options.escape || escape, unavailable=!!options.disabled;
    const attributes=unavailable && kind==="product" ? 'aria-disabled="true" tabindex="-1" data-refilling="true"' : `href="${e(options.href)}"${options.quick || ""}`;
    const label=options.search || item.name;
    return `<a class="image-tile f90-brand-card f90-brand-${kind}${unavailable && kind==="product" ? " refilling" : ""}" ${attributes} style="${style(item,kind)}" data-search="${e(label)}" aria-label="${e(item.name)}"><span class="f90-brand-card-art">${options.image}</span>${unavailable && kind==="product" ? '<span class="refill-badge">قيد التعبئة</span>' : ""}<span class="tile-caption">${e(item.name)}</span></a>`;
  }
  const api={isCategory,isProduct,meta,style,gridStyle,render};
  root.F90BrandCards=api;
  if(typeof module!=="undefined" && module.exports)module.exports=api;
})(typeof window!=="undefined" ? window : globalThis);
