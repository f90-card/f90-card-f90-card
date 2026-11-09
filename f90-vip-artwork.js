/* Unified luxury VIP insignia. One design language, fifteen progressively richer ranks. */
(function(root){
"use strict";
const palettes=[
["#dbe5f4","#64748b","#f8fbff"],["#6ce8ff","#0b83b9","#effdff"],["#75aaff","#2048a7","#eaf0ff"],
["#f8c976","#a36a22","#fff5d7"],["#8df3f6","#118da6","#edffff"],["#d5a0ff","#7435ae","#f9eaff"],
["#ffb66c","#b84d1c","#fff0d9"],["#f7dc83","#a67b25","#fff9d8"],["#ff809e","#a72253","#ffe6ee"],
["#ffcb7a","#b62e32","#fff1d7"],["#76efc7","#0b9a77","#e5fff4"],["#a9a2ff","#5043b6","#f0efff"],
["#ffabd9","#b13a8b","#fff0fa"],["#86f4ff","#0877ad","#e9fcff"],["#fff2b3","#ca8a27","#ffffff"]
];
function seal(level){
const n=Math.max(1,Math.min(15,Math.floor(Number(level)||1)));
const [light,dark,shine]=palettes[n-1];
const id="f90vip"+n;
const prestige=Math.ceil(n/3);
const stars=Array.from({length:Math.min(5,prestige)},(_,i)=>{const x=44+(i-(Math.min(5,prestige)-1)/2)*12;return '<path d="M'+x+' 11l1.7 3.5 3.8.5-2.8 2.6.7 3.7-3.4-1.9-3.4 1.9.7-3.7-2.8-2.6 3.8-.5Z" fill="'+light+'"/>';}).join("");
const laurel=n>=4?'<g fill="none" stroke="'+light+'" stroke-width="'+(n>=11?2.3:1.5)+'" opacity=".92"><path d="M24 35Q5 51 26 77M64 35Q83 51 62 77"/>'+Array.from({length:5},(_,i)=>{let y=42+i*7;return '<path d="M'+(19-i%2*2)+' '+y+'l-8 -5 4 11M'+(69+i%2*2)+' '+y+'l8 -5 -4 11"/>';}).join("")+'</g>':'';
const wings=n>=8?'<path d="M20 43 5 34 11 50 2 58 22 63M68 43 83 34 77 50 86 58 66 63" stroke="'+light+'" stroke-width="2.3" fill="none" opacity=".86"/>':'';
const crown=n>=12?'<path d="M30 28 27 15 37 21 44 10 51 21 61 15 58 28Z" fill="url(#'+id+'metal)" stroke="'+shine+'" stroke-width="1.5"/>':'<path d="M34 28 31 20 39 23 44 17 49 23 57 20 54 28Z" fill="url(#'+id+'metal)" stroke="'+shine+'" stroke-width="1.1"/>';
const halo=n>=14?'<circle cx="44" cy="48" r="38" fill="none" stroke="'+light+'" stroke-width="1.8" stroke-dasharray="2 3" opacity=".8"/>':'';
return '<svg class="f90-vip-artwork f90-vip-artwork-'+n+'" viewBox="0 0 88 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="شارة VIP '+n+'">'
+'<defs><linearGradient id="'+id+'metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+shine+'"/><stop offset=".28" stop-color="'+light+'"/><stop offset=".52" stop-color="'+dark+'"/><stop offset=".8" stop-color="'+light+'"/><stop offset="1" stop-color="'+shine+'"/></linearGradient><radialGradient id="'+id+'core"><stop stop-color="'+dark+'"/><stop offset="1" stop-color="#080d19"/></radialGradient></defs>'
+halo+wings+laurel
+'<path d="M44 21 66 29 71 49 64 70 44 88 24 70 17 49 22 29Z" fill="#0c101c" stroke="'+dark+'" stroke-width="5"/>'
+'<path d="M44 21 66 29 71 49 64 70 44 88 24 70 17 49 22 29Z" fill="url(#'+id+'core)" stroke="url(#'+id+'metal)" stroke-width="3.5"/>'
+'<path d="M44 28 60 34 64 50 58 66 44 78 30 66 24 50 28 34Z" fill="none" stroke="'+light+'" stroke-width="1" opacity=".65"/>'
+crown+stars
+'<path d="M44 35 53 44 44 54 35 44Z" fill="url(#'+id+'metal)" stroke="'+shine+'" stroke-width="1.4"/>'
+'<path d="M29 59Q44 55 59 59L57 72H31Z" fill="url(#'+id+'metal)" stroke="'+shine+'" stroke-width="1.1"/>'
+'<text x="44" y="68" text-anchor="middle" fill="#0a0e17" font-size="'+(n>=10?10:12)+'" font-weight="900" font-family="Arial,sans-serif">VIP'+n+'</text>'
+'<path d="M35 82 44 91 53 82" fill="none" stroke="'+light+'" stroke-width="2" opacity=".9"/>'
+'</svg>';
}
root.F90VipArtwork={seal,palettes};
})(window);
