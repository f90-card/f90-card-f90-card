import fs from "node:fs/promises";
import { chromium } from "playwright";

// Read-only testing of public pages. It NEVER signs in, submits a deposit, or buys anything.
const ROOT = process.env.F90_TEST_URL || "https://f90-card.github.io/f90-card-f90-card/";
const profiles = [
 { name:"mobile-360",width:360,height:780,mobile:true },
 { name:"mobile-393",width:393,height:852,mobile:true },
 { name:"tablet-768",width:768,height:1024,mobile:true },
 { name:"desktop-1440",width:1440,height:900,mobile:false },
];
const routes = ["#/","#/welcome","#/vip","#/support","#/policy/about","#/policy/privacy","#/policy/terms","#/policy/purchase","#/policy/deposits","#/policy/usage","#/policy/resellers","#/search","#/favorites","#/notifications","#/install","#/quran","#/auth","#/wallet","#/deposit","#/orders","#/history","#/verification","#/security"];
await fs.mkdir("artifacts/f90-smoke",{recursive:true});
const browser = await chromium.launch({headless:true});
const results=[];
try {
 for (const view of profiles) {
   const context=await browser.newContext({
     viewport:{width:view.width,height:view.height},isMobile:view.mobile,
     hasTouch:view.mobile,deviceScaleFactor:1,reducedMotion:"reduce",
   });
   const page=await context.newPage();
   let jsErrors=[];
   page.on("pageerror",err=>jsErrors.push(err.message));
   const firstResponse=await page.goto(ROOT,{waitUntil:"domcontentloaded",timeout:25000});
   const baseStatus=firstResponse?.status();
   for (const hash of routes) {
     jsErrors=[];
     const label=hash==="#/"?"home":hash.replaceAll(/[#/]+/g,"-").replace(/^-|-$/g,"");
     const start=Date.now();
     try {
       const response=await page.goto(ROOT+hash,{waitUntil:"domcontentloaded",timeout:25000});
       await page.waitForFunction(()=>{
         const main=document.querySelector("#mainContent");
         return main?.children?.length>0 &&
           !main?.textContent?.includes("جارٍ تجهيز عالمك الرقمي");
       },null,{timeout:18000});
       await page.waitForTimeout(250);
       const geometry=await page.evaluate(()=>({
         width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
         height:document.documentElement.scrollHeight,
         title:document.title,
         visible:!!document.querySelector("#mainContent")?.textContent?.trim(),
         loading:!!document.querySelector("#mainContent")?.textContent?.includes("جارٍ تجهيز عالمك الرقمي"),
       }));
       const overflow=geometry.scrollWidth>geometry.width+20;
       // Hash-router navigation is a same-document change. Chromium correctly
       // returns null for these navigations; the initial HTTP response is
       // authoritative, while each route still must finish rendering cleanly.
       const status=response?.status() ?? baseStatus;
       const valid=(status===200)&&geometry.visible&&!geometry.loading&&!overflow&&!jsErrors.length;
       results.push({view:view.name,route:hash,valid,status,
         ms:Date.now()-start,overflow,geometry,errors:jsErrors.slice(0,3)});
       if(hash==="#/")await page.screenshot({path:"artifacts/f90-smoke/"+view.name+"-home.png",fullPage:true});
     } catch(err) {
       results.push({view:view.name,route:hash,valid:false,error:String(err).slice(0,450)});
     }
   }
   // Read-only checkout geometry: no login, no submit, no wallet operations.
   // Use currently published categories so tests do not depend on one product ID.
   if (view.mobile && view.width <= 393) {
     try {
       await page.goto(ROOT+"#/",{waitUntil:"domcontentloaded",timeout:25000});
       await page.waitForSelector("#mainContent",{timeout:15000});
       await page.waitForTimeout(400);
       const initial=await page.locator('#mainContent a[href^="#/category/"]').evaluateAll(
         links=>[...new Set(links.map(a=>a.getAttribute("href")))].slice(0,12)
       );
       const queue=[...initial],seen=new Set();
       let found=false;
       while(queue.length && seen.size<16 && !found){
         const dest=queue.shift();
         if(!dest||seen.has(dest))continue;
         seen.add(dest);
         await page.goto(ROOT+dest,{waitUntil:"domcontentloaded",timeout:20000});
         await page.waitForTimeout(300);
         const products=page.locator('#mainContent [data-action="quick-product"]');
         if(await products.count()){
           await products.first().click();
           found=true;
           await page.waitForSelector('body.f90-checkout-open #quickProductPanel:not([hidden])',{timeout:5000});
           await page.setViewportSize({width:view.width,height:425});
           const field=page.locator('#quickProductPanel input[name^="customer_"]').first();
           if(await field.count())await field.focus();
           await page.waitForTimeout(250);
           const geometry=await page.evaluate(()=>{
             const card=document.querySelector("#quickProductPanel");
             const v=window.visualViewport;
             const top=v?.offsetTop||0,height=v?.height||window.innerHeight;
             const b=card.getBoundingClientRect();
             const hidden=n=>getComputedStyle(document.querySelector(n)).display==="none";
             return {portal:card.parentElement===document.body,
               footerHidden:hidden("#footer"),dockHidden:hidden("#mobileDock"),
               cardWithinView:b.top>=top-10&&b.bottom<=top+height+10,
               panelHeight:b.height,viewHeight:height};
           });
           const valid=geometry.portal&&geometry.footerHidden&&
             geometry.dockHidden&&geometry.cardWithinView;
           results.push({view:view.name,route:"checkout-with-keyboard",
             valid,geometry});
           await page.screenshot({path:"artifacts/f90-smoke/"+view.name+"-checkout-keyboard.png"});
           await page.locator('#quickProductPanel [data-action="close-quick-product"]').first().click();
           if(await page.locator("body.f90-checkout-open").count())
             results.push({view:view.name,route:"checkout-close",valid:false,error:"Checkout did not close"});
         } else {
           const children=await page.locator('#mainContent a[href^="#/category/"]').evaluateAll(
             links=>[...new Set(links.map(a=>a.getAttribute("href")))].slice(0,10)
           );
           queue.push(...children);
         }
       }
     } catch(err) {
       results.push({view:view.name,route:"checkout-with-keyboard",valid:false,error:String(err).slice(0,450)});
     } finally {
       await page.setViewportSize({width:view.width,height:view.height});
     }
   }
   // The admin entry should not expose management functionality to a visitor.
   try {
     await page.goto(ROOT+"admin.html",{waitUntil:"domcontentloaded",timeout:25000});
     await page.waitForTimeout(1000);
     const hasAdminControls=await page.locator('[data-action="catalog-delete"],[data-action="review-deposit"]').count();
     results.push({view:view.name,route:"admin.html",valid:hasAdminControls===0,
       guestAdminControls:hasAdminControls});
     await page.screenshot({path:"artifacts/f90-smoke/"+view.name+"-admin.png",fullPage:true});
   } catch(err) {
     results.push({view:view.name,route:"admin.html",valid:false,error:String(err).slice(0,450)});
   }
   await context.close();
 }
} finally { await browser.close(); }
const summary={captured_at:new Date().toISOString(),scope:"Public/guest-only; no purchases or deposits",
  results,passed:results.filter(x=>x.valid).length,failed:results.filter(x=>!x.valid).length};
await fs.writeFile("artifacts/f90-smoke/results.json",JSON.stringify(summary,null,2));
console.log(JSON.stringify({passed:summary.passed,failed:summary.failed,
  failures:results.filter(x=>!x.valid).map(x=>({view:x.view,route:x.route,error:x.error,errors:x.errors,overflow:x.overflow}))},null,2));
if(summary.failed)process.exitCode=1;
