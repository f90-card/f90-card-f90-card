/* Screenshot-driven header, drawer and customer contact.
 * Product/order, wallet, VIP eligibility and authentication sources remain authoritative. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 const escapeText=v=>String(v==null?"":v);
 const svgBack='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5m7-7-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 const svgCrown='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m2 8 5 4 5-7 5 7 5-4-2 11H4L2 8Z" stroke-linejoin="round"/><path d="M4 22h16"/></svg>';
 const svgHeart='<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 21 3.3 12.6C-1 8.4 5.4 1.5 10 5.9L12 8l2-2.1c4.6-4.4 11 2.5 6.7 6.7L12 21Z"/></svg>';
 const svgUser='<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="12" cy="7.5" r="4"/><path d="M3.5 22v-2.2c0-7.2 17-7.2 17 0V22Z"/></svg>';
 const svgExit='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3H5v18h7M15 8l4 4-4 4M8 12h11"/></svg>';
 const svgWa='<svg viewBox="0 0 32 32" aria-hidden="true" fill="currentColor"><path d="M16 3a13 13 0 0 0-11 20l-2 7 7.3-2A13 13 0 1 0 16 3Zm0 2.5A10.5 10.5 0 0 1 25.2 21 10.5 10.5 0 0 1 12 25.1l-.6-.2-4.7 1.3 1.2-4.6-.4-.6A10.5 10.5 0 0 1 16 5.5Zm-5 4c-.7 0-1.3.2-1.8 1-.6.9-1.1 2.1-.8 3.3.8 3 4.1 6.5 7.3 7.8 2 .8 3.7 1.1 5.3-.4.6-.5 1.2-1.5 1.3-2 0-.4-.2-.6-.5-.8l-3-1.4c-.3-.1-.6-.1-.8.2l-1.2 1.5c-.2.3-.5.3-.8.1-1.6-.8-3.7-2.6-4.4-4-.1-.3 0-.5.2-.8l.9-1c.2-.2.3-.5.2-.9l-1.4-3c-.2-.5-.3-.6-.8-.6Z"/></svg>';
 const num=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||min));
 let latest=null;
 let mfaGeneration=0;
 let mfaIdentity="";
 let mfaCached;
 function buildHeader(ctx){
   const root=$("headerBrand");
   const header=root&&root.closest(".header-inner");
   if(!root||!header)return;
   document.documentElement.dataset.f90SignedIn=ctx.me?"true":"false";
   // The configured logo image is the entire visible brand; no duplicated text.
   root.querySelectorAll(".f90-reference-brand-name,.brand-name").forEach(el=>el.remove());
   root.setAttribute("aria-label",escapeText(ctx.settings?.store_name||"أف تسعين كارد"));
   const img=root.querySelector("img");
   if(img){img.alt=escapeText(ctx.settings?.store_name||"F90 CARD");img.loading="eager";img.decoding="async";}
   let back=$("f90ReferenceBack");
   if(!back){back=document.createElement("a");back.id="f90ReferenceBack";back.className="f90-reference-back";back.href="#/";back.innerHTML=svgBack;back.title="العودة للرئيسية";back.setAttribute("aria-label","العودة للرئيسية");header.insertBefore(back,root);}
   let vip=$("f90ReferenceHeaderVip");
   if(!vip){
     vip=document.createElement("a");vip.id="f90ReferenceHeaderVip";vip.className="f90-header-vip";
     vip.href="#/vip";vip.innerHTML=svgCrown+'<span class="f90-header-vip-level"></span>';
     vip.title="مستويات VIP";vip.setAttribute("aria-label","مستويات VIP");
     const actions=header.querySelector(".header-actions");
     if(actions)actions.append(vip);
   }
   const level=ctx.me?num(ctx.me.vip_level,1,Math.max(1,ctx.tierCount||15)):null;
   // Use the very same tier artwork from the VIP page.
   vip.dataset.f90VipLevel=String(level||1);
   vip.innerHTML=window.F90VipArtwork?.seal(level||1)||svgCrown+'<span class="f90-header-vip-level">'+(level?"VIP"+level:"VIP")+'</span>';
   const picker=$("f90-language-control");
   if(picker){
     const textNode=Array.from(picker.childNodes).find(n=>n.nodeType===Node.TEXT_NODE);
     if(textNode)textNode.nodeValue="文A ";
     const select=picker.querySelector("select");
     if(select)select.setAttribute("aria-label","تغيير لغة الموقع");
   }
   const wallet=$("headerWallet");
   if(wallet&&!wallet.querySelector(".f90-wallet-plus")){
     wallet.querySelector("svg")?.remove();
     const plus=document.createElement("span");plus.className="f90-wallet-plus";plus.textContent="+";wallet.prepend(plus);
   }
   updateBack();
 }
 function updateBack(){
   const back=$("f90ReferenceBack");
   if(!back)return;
   const page=(location.hash||"#/").replace(/^#\//,"").split("/")[0]||"";
   back.hidden=!page;
   document.documentElement.dataset.f90InnerPage=page?"true":"false";
 }
 function addDrawerProfile(ctx){
   const host=$("drawerProfile");
   if(!host)return;
   const identity=host.querySelector(".f90-drawer-identity");
   const old=identity?.querySelector(".drawer-profile");
   if(!identity||!old||old.dataset.referenceNavigation==="1")return;
   const avatar=old.querySelector(".avatar");
   const label=document.createElement("span");
   label.className="f90-drawer-username";
   label.textContent=escapeText(ctx.me?.profile?.display_name || (ctx.me?"حسابي":"مرحباً بك"));
   const userId=document.createElement("small");
   userId.className="f90-drawer-customerid";
   if(ctx.me?.profile?.customer_id)userId.textContent="#"+ctx.me.profile.customer_id;
   const inline=document.createElement("span");
   inline.className="f90-drawer-id-line";
   inline.append(label,userId);
   old.replaceChildren();
   if(avatar)old.append(avatar);
   old.append(inline);
   old.dataset.referenceNavigation="1";
   let balance=identity.querySelector(".f90-drawer-balance");
   if(!balance){balance=document.createElement("a");balance.href="#/wallet";balance.className="f90-drawer-balance";identity.append(balance);}
   balance.textContent=ctx.me?escapeText(ctx.balanceText||"—"):"";
   balance.hidden=!ctx.me;
   const oldVip=host.querySelector(".f90-drawer-vip-link");
   if(oldVip){
     oldVip.innerHTML=svgCrown+'<span></span>';
     oldVip.querySelector("span").textContent=ctx.me?"⭐ VIP"+num(ctx.me.vip_level,1,Math.max(1,ctx.tierCount||15)):"⭐ مستويات VIP";
     identity.append(oldVip);
   }
   const existingLogout=identity.querySelector(".f90-drawer-session");
   existingLogout?.remove();
   let actions=identity.querySelector(".f90-drawer-account-actions");
   if(!actions){actions=document.createElement("nav");actions.className="f90-drawer-account-actions";identity.append(actions);}
   actions.innerHTML='';
   function link(href,label,markup){
     const a=document.createElement("a");a.href=href;a.title=label;a.setAttribute("aria-label",label);a.innerHTML=markup;return a;
   }
   if(ctx.me){
     actions.append(link("#/favorites","المفضلة",svgHeart),link("#/profile","ملفي الشخصي",svgUser));
     const logout=document.createElement("button");logout.type="button";logout.title="تسجيل الخروج";logout.setAttribute("aria-label","تسجيل الخروج");logout.dataset.action="logout";logout.innerHTML=svgExit;actions.append(logout);
   }else actions.append(link("#/auth","تسجيل الدخول",svgUser),link("#/vip","مستويات VIP",svgCrown));
 }
 function syncSecondaryCurrency(ctx){
   const drawer=$("drawer"),profile=$("drawerProfile");
   if(!drawer||!profile)return;
   let shell=$("f90DrawerCurrencyShell");
   if(!shell){
     shell=document.createElement("section");shell.id="f90DrawerCurrencyShell";shell.className="f90-drawer-currency-shell";
     const button=document.createElement("button");button.id="f90DrawerSecondaryToggle";button.type="button";
     button.className="f90-drawer-secondary-toggle";button.setAttribute("aria-expanded","false");
     button.setAttribute("aria-controls","f90DrawerSecondaryPanel");
     const panel=document.createElement("div");panel.id="f90DrawerSecondaryPanel";panel.className="f90-drawer-secondary-panel";panel.hidden=true;
     button.addEventListener("click",()=>{
       panel.hidden=!panel.hidden;
       button.setAttribute("aria-expanded",String(!panel.hidden));
     });
     shell.append(button,panel);
   }
   profile.insertAdjacentElement("afterend",shell);
   const picker=$("f90SecondaryCurrencies");
   if(picker&&picker.parentElement!==$("f90DrawerSecondaryPanel"))$("f90DrawerSecondaryPanel").append(picker);
   const active=ctx.secondaryCurrency||"";
   $("f90DrawerSecondaryToggle").textContent="⟳  "+active+" · العملة الثانوية";
   $("f90DrawerSecondaryToggle").setAttribute("aria-label","تغيير العملة الثانوية الحالية "+active);
   // The account currency selector remains in the normal preferences section.
 }
 function syncSocial(ctx){
   const host=$("drawerLinks")?.querySelector(".f90-reference-social");
   if(!host)return;
   host.classList.add("f90-reference-social-icons");
   // Use only actual configured Instagram, TikTok and the official customer-service
   // WhatsApp number (not the public announcement/channel URL).
   const links=Array.isArray(ctx.settings?.config?.social_links)?ctx.settings.config.social_links:[];
   const allowed=[
      {key:"ig",hostnames:["instagram.com","www.instagram.com"],icon:"https://cdn.simpleicons.org/instagram/E4405F",name:"إنستجرام"},
      {key:"tt",hostnames:["tiktok.com","www.tiktok.com"],icon:"https://cdn.simpleicons.org/tiktok/25F4EE",name:"تيك توك"}
   ];
   const entries=[];
   for(const kind of allowed){
     const item=links.find(v=>{
       if(v?.enabled===false)return false;
       try {const u=new URL(String(v.url));return u.protocol==="https:"&&kind.hostnames.includes(u.hostname);}catch{return false;}
     });
     if(item)entries.push({key:kind.key,name:kind.name,url:item.url,icon:kind.icon});
   }
   const phone=String(ctx.settings?.config?.whatsapp||"").replace(/\D/g,"");
   if(/^\d{8,15}$/.test(phone))entries.push({
      key:"wa",name:"خدمة العملاء واتساب",url:"https://wa.me/"+phone,
      icon:"https://cdn.simpleicons.org/whatsapp/25D366"
   });
   host.replaceChildren();
   for(const entry of entries){
     const a=document.createElement("a");
     a.href=entry.url;a.target="_blank";a.rel="noopener noreferrer";
     a.dataset.social=entry.key;a.title=entry.name;a.setAttribute("aria-label",entry.name);
     const img=document.createElement("img");
     img.src=entry.icon;img.alt=entry.name;img.loading="lazy";img.width=25;img.height=25;
     a.appendChild(img);
     host.appendChild(a);
   }
   host.hidden=!entries.length;
 }
 function syncWhatsapp(ctx){
   let bubble=$("f90CustomerWhatsapp");
   const phone=String(ctx.settings?.config?.whatsapp||"").replace(/\D/g,"");
   if(!/^\d{8,15}$/.test(phone)){bubble?.remove();return;}
   if(!bubble){bubble=document.createElement("a");bubble.id="f90CustomerWhatsapp";bubble.className="f90-customer-whatsapp";bubble.innerHTML=svgWa;document.body.append(bubble);}
   bubble.href="https://wa.me/"+phone+"?text="+encodeURIComponent("مرحباً، أحتاج مساعدة من خدمة عملاء F90 CARD.");
   bubble.target="_blank";
   bubble.rel="noopener noreferrer";
   bubble.title="التواصل مع خدمة العملاء عبر واتساب";
   bubble.setAttribute("aria-label","تواصل مباشرة مع خدمة العملاء عبر واتساب");
 }
 function getMfaContainer(){
   let bar=$("f90MfaReminder");
   if(!bar){
     bar=document.createElement("div");bar.id="f90MfaReminder";bar.className="f90-mfa-reminder";bar.hidden=true;
     bar.innerHTML='<span class="f90-mfa-reminder-copy">⚠️ حرصاً على أمان حسابك يُنصح بتفعيل المصادقة الثنائية</span><a href="#/security">الحماية</a>';
     const promo=$("promotionBar");
     if(promo)promo.parentElement.insertBefore(bar,promo);
     else document.querySelector(".site-header")?.after(bar);
   }
   return bar;
 }
 function syncMfa(ctx){
   const bar=getMfaContainer();
   if(!bar)return;
   const id=ctx.me?.profile?.customer_id||ctx.me?.id||null;
   if(!ctx.me||ctx.me?.needs_mfa||!id){
     ++mfaGeneration;
     mfaIdentity="";
     mfaCached=undefined;
     bar.hidden=true;return;
   }
   if(id===mfaIdentity && typeof mfaCached==="boolean"){bar.hidden=mfaCached;return;}
   mfaIdentity=id;
   mfaCached=undefined;
   bar.hidden=true;
   const gen=++mfaGeneration;
   const auth=window.F90API?.client?.auth;
   if(!auth?.mfa?.listFactors)return;
   Promise.resolve(auth.mfa.listFactors()).then(result=>{
      if(gen!==mfaGeneration)return;
      if(result.error||!result.data)return;
      const factors=[...(Array.isArray(result.data.all)?result.data.all:[]),...(Array.isArray(result.data.totp)?result.data.totp:[])];
      const verified=factors.some(f=>f&&f.status==="verified");
      mfaCached=verified;
      bar.hidden=verified;
   }).catch(()=>{if(gen===mfaGeneration)bar.hidden=true;});
 }
 function sync(ctx){
   if(!ctx||!ctx.settings)return;
   latest=ctx;
   buildHeader(ctx);
   addDrawerProfile(ctx);
   syncSecondaryCurrency(ctx);
   syncSocial(ctx);
   syncWhatsapp(ctx);
   syncMfa(ctx);
 }
 window.addEventListener("hashchange",()=>requestAnimationFrame(updateBack));
 document.addEventListener("click",event=>{
   if(event.target.closest?.("[data-f90-secondary-currency]")){
      requestAnimationFrame(()=>{
       if(!latest)return;
       const selected=$("f90SecondaryCurrencies")?.querySelector("button.active");
       if(selected&&$("f90DrawerSecondaryToggle"))$("f90DrawerSecondaryToggle").textContent="⟳  "+selected.dataset.f90SecondaryCurrency+" · العملة الثانوية";
      });
   }
 });
 window.F90ReferenceNavigation={sync,updateBack};
})();
