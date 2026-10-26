/* Fifteen individually designed customer VIP emblems.
 * Decoration only. Eligibility, rank, thresholds and discounts remain server-provided. */
(function(root){
 "use strict";
 const palettes=[
  ["#dbe5f4","#5f7085","#f6fbff"],   // 1 silver
  ["#58d7ff","#0666d7","#defbff"],   // 2 cyan
  ["#619dff","#1532bd","#e6edff"],   // 3 sapphire
  ["#ffd06b","#9b5008","#fff3c8"],   // 4 amber
  ["#68ecff","#0084cd","#edfbff"],   // 5 ice
  ["#e191ff","#6d17b9","#f9e9ff"],   // 6 amethyst
  ["#ffab53","#c12b09","#ffe5a5"],   // 7 flame
  ["#f6da77","#754009","#fff4bf"],   // 8 antique gold
  ["#ff6680","#a30c2d","#ffe3e7"],   // 9 ruby
  ["#ffbd5e","#c51b14","#ffefd5"],   // 10 crimson
  ["#47f5b9","#007a67","#e6fff3"],   // 11 emerald
  ["#8b9dff","#4433b4","#efefff"],   // 12 violet
  ["#ff9bcd","#a41a79","#ffe8fa"],   // 13 rose
  ["#63edec","#006d8f","#e5ffff"],   // 14 arctic
  ["#fff0a5","#cf7714","#fffbe2"]    // 15 royal
 ];
 const silhouettes=[
  "M44 12 66 20 69 50 59 70 44 81 29 70 19 50 22 20Z",
  "M44 11 70 22 66 56 44 82 22 56 18 22Z",
  "M44 9 64 16 73 42 60 66 44 84 28 66 15 42 24 16Z",
  "M44 12 65 19 74 37 65 64 44 83 23 64 14 37 23 19Z",
  "M44 10 69 19 71 49 58 72 44 85 30 72 17 49 19 19Z"
 ];
 const gems=[
  '<path d="M32 39 44 29 56 39 44 56Z"/>',
  '<path d="M31 41 37 33 51 33 57 41 44 56Z"/>',
  '<path d="m44 29 4 9 10 2-7 7 2 10-9-5-9 5 2-10-7-7 10-2Z"/>',
  '<path d="M44 28c10 11 13 15 8 23-6 10-17 8-19-1-1-5 7-16 11-22Z"/>',
  '<circle cx="44" cy="42" r="12"/><path d="M44 31v22M33 42h22"/>'
 ];
 function seal(level){
  const n=Math.max(1,Math.min(15,Math.floor(Number(level)||1)));
  const [light,dark,highlight]=palettes[n-1];
  const variant=(n-1)%5;
  const g="f90-rank-"+n;
  const s=silhouettes[variant];
  const gem=gems[variant];
  const rays=Array.from({length:2+n%4},(_,i)=>{
   const angle=(-66+i*132/(1+n%4))*Math.PI/180;
   const x=(44+38*Math.sin(angle)).toFixed(1),y=(43-38*Math.cos(angle)).toFixed(1);
   return '<circle cx="'+x+'" cy="'+y+'" r="'+(1.1+n%3*.3)+'" fill="'+light+'" opacity=".95"/>';
  }).join("");
  const wings=n>2
   ?'<path d="M24 30 8 22 13 39 2 48 20 52M64 30 80 22 75 39 86 48 68 52" stroke="'+light+'" stroke-width="'+(1.2+n/15*1.6)+'" fill="none" opacity=".86"/>'
   :'';
  const flourishes=n>7?'<path d="M28 75 12 68 25 63M60 75 76 68 63 63" stroke="'+light+'" stroke-width="2" fill="none"/>':'';
  return '<svg class="f90-vip-artwork f90-vip-artwork-'+n+'" viewBox="0 0 88 94" role="img" aria-label="شارة VIP'+n+'" xmlns="http://www.w3.org/2000/svg">'
   +'<defs><linearGradient id="'+g+'" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+light+'"/><stop offset=".48" stop-color="'+dark+'"/><stop offset="1" stop-color="'+light+'"/></linearGradient></defs>'
   +rays+wings
   +'<path d="'+s+'" fill="#0e172a" stroke="'+light+'" stroke-width="3"/>'
   +'<path d="'+s+'" fill="none" stroke="url(#'+g+')" stroke-width="7" stroke-dasharray="'+(variant%2?'18 2':'100 0')+'" opacity=".42"/>'
   +'<path d="M29 17 36 7 44 15 52 7 59 17 57 23 31 23Z" fill="url(#'+g+')" stroke="'+highlight+'" stroke-width="1.4"/>'
   +'<g fill="url(#'+g+')" stroke="'+highlight+'" stroke-width="1.6">'+gem+'</g>'
   +'<path d="M26 60 Q44 55 62 60L59 74H29Z" fill="url(#'+g+')" stroke="'+highlight+'" stroke-width="1.3"/>'
   +'<text x="44" y="68" text-anchor="middle" fill="#101526" font-weight="900" font-size="'+(n>9?'10':'12')+'" font-family="Arial,sans-serif">VIP'+n+'</text>'
   +flourishes+'</svg>';
 }
 root.F90VipArtwork={seal,palettes};
})(window);
