import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const base="https://www.f90card.online/";
const pages=["","discover/","discover/games.html","discover/apps.html","discover/cards.html","discover/streaming.html","discover/mobile.html","discover/ai.html","discover/social.html","discover/services.html","discover/transfers.html","discover/accounts.html","discover/design.html","discover/website.html"];
const local=x=>x?x==="discover/"?"discover/index.html":x:"index.html";
test("F90 sitemap contains only published canonical URLs without duplicates",()=>{
 const map=read("sitemap.xml");
 const urls=[...map.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
 assert.equal(urls.length,pages.length);
 assert.deepEqual(new Set(urls).size,pages.length);
 assert.deepEqual(urls,pages.map(p=>base+p));
 for(const p of pages){
   const html=read(local(p));
   const canonical=base+p;
   assert.ok(html.includes('rel="canonical" href="'+canonical+'"')||html.includes('rel="canonical" href="'+canonical+'" />'),p+" canonical is wrong");
   assert.ok(!/<meta name="robots" content="noindex/i.test(html),p+" unexpectedly noindex");
 }
});
test("Every indexed directory page is readable without client JavaScript",()=>{
 const index=read("discover/index.html");
 for(const p of pages.filter(x=>x.startsWith("discover/")&&x!=="discover/")){
   const slug=p.split("/").pop();
   assert.match(index,new RegExp('href="\\./'+slug.replace(".","\\.")+'"'));
   const html=read(p);
   assert.match(html,/<h1>[^<]+<\/h1>/);
   assert.match(html,/<meta name="description" content="[^"]{35,}"/);
   assert.match(html,/<script type="application\/ld\+json">/);
   const metadata=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
   assert.ok(metadata,p+" structured metadata missing");
   assert.doesNotThrow(()=>JSON.parse(metadata[1]));
   for(const m of html.matchAll(/\b(?:src|href)="\.\.\/([^"#?]+)"/g)){
     assert.ok(fs.existsSync(path.join(root,m[1])),p+" broken resource "+m[1]);
   }
 }
});
test("Indexability and sitemap are discoverable, while admin pages remain noindex",()=>{
 assert.match(read("index.html"),/rel="sitemap"/);
 assert.match(read("index.html"),/f90-seo-directory-link/);
 assert.match(read("admin.html"),/content="noindex"/);
 assert.match(read("robots.txt"),/Sitemap: https:\/\/www\.f90card\.online\/sitemap\.xml/);
});
