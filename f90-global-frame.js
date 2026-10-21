/* F90 CARD shared visual frame; catalog data and checkout remain untouched. */
(function(){"use strict";
 const styles=new Set(["lightning","silver","gold"]);
 function imageUrl(raw){
  if(typeof raw!=="string"||raw.length>2048||!raw.trim())return "";
  try{const url=new URL(raw.trim(),document.baseURI);return url.protocol==="https:"||(url.protocol==="http:"&&url.origin===location.origin)?url.href:""}catch{return ""}
 }
 window.F90GlobalFrame={apply(config,logo){
  const root=document.documentElement,o=config?.card_frame||{};
  root.classList.toggle("f90-global-frame-on",o.enabled!==false);
  root.classList.toggle("f90-frame-no-logo",o.show_logo===false);
  const frame=imageUrl(o.image_url);
  // Backward compatibility: older admin saved an uploaded image alongside mode=soft.
  // New explicit soft choices carry image_mode_explicit=true.
  const imageMode=!!frame && (o.mode==="image" || o.image_mode_explicit!==true && o.mode!=="image");
  root.dataset.f90FrameMode=imageMode?"image":"soft";
  root.classList.toggle("f90-frame-custom",imageMode);
  root.dataset.f90FramePreset=styles.has(o.preset)?o.preset:"lightning";
  const mark=imageUrl(logo)||imageUrl("./f90-logo.png");
  if(frame)root.style.setProperty("--f90-frame-art","url("+JSON.stringify(frame)+")");
  else root.style.removeProperty("--f90-frame-art");
  if(mark)root.style.setProperty("--f90-frame-logo","url("+JSON.stringify(mark)+")");
  root.style.setProperty("--f90-frame-opacity",String(Math.max(.35,Math.min(1,Number(o.opacity)||1))));
 }};
})();
