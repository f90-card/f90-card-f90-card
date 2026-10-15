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
const routes = ["#/","#/welcome","#/vip","#/support","#/policy/about","#/auth"];
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
   for (const hash of routes) {
     jsErrors=[];
     const label=hash==="#/"?"home":hash.replaceAll(/[#/]+/g,"-").replace(/^-|-$/g,"");
     const start=Date.now();
     try {
       const response=await page.goto(ROOT+hash,{waitUntil:"domcontentloaded",timeout:25000});
       await page.waitForFunction(()=>document.querySelector("#mainContent")?.children?.length>0,null,{timeout:16000});
       await page.waitForTimeout(1200);
       const geometry=await page.evaluate(()=>({
         width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
         height:document.documentElement.scrollHeight,
         title:document.title,
         visible:!!document.querySelector("#mainContent")?.textContent?.trim(),
         loading:!!document.querySelector("#mainContent")?.textContent?.includes("جارٍ تجهيز عالمك الرقمي"),
       }));
       const overflow=geometry.scrollWidth>geometry.width+20;
       const valid=(response?.status()===200)&&geometry.visible&&!geometry.loading&&!overflow&&!jsErrors.length;
       results.push({view:view.name,route:hash,valid,status:response?.status(),
         ms:Date.now()-start,overflow,geometry,errors:jsErrors.slice(0,3)});
       if(hash==="#/")await page.screenshot({path:"artifacts/f90-smoke/"+view.name+"-home.png",fullPage:true});
     } catch(err) {
       results.push({view:view.name,route:hash,valid:false,error:String(err).slice(0,450)});
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
