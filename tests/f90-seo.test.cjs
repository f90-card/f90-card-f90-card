const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const base="https://f90-card.github.io/f90-card-f90-card/";
const urls=["","discover/","discover/games.html","discover/apps.html","discover/cards.html",
"discover/streaming.html","discover/mobile.html","discover/ai.html","discover/social.html",
"discover/services.html","discover/transfers.html","discover/accounts.html",
"discover/design.html","discover/website.html"];
const page=part=>part===""?"index.html":part==="discover/"?"discover/index.html":part;
test("every sitemap URL points to a real canonical landing page",()=>{
 const xml=read("sitemap.xml");
 const locations=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
 assert.equal(locations.length,urls.length);
 assert.equal(new Set(locations).size,locations.length);
 for(const relative of urls){
  assert.ok(locations.includes(base+relative),"Missing sitemap entry: "+relative);
  assert.ok(fs.existsSync(path.join(root,page(relative))),"Missing HTML file: "+relative);
 }
 assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
});
test("indexable category landings have accurate canonicals, meta, schema and images",()=>{
 const titles=new Set();
 for(const relative of urls.filter(x=>x.endsWith(".html"))){
  const html=read(page(relative));
  assert.match(html,/<html lang="ar" dir="rtl">/);
  assert.match(html,/<meta name="description" content="[^"]{45,}">/);
  assert.ok(html.includes('href="'+base+relative+'"'),"canonical incorrect: "+relative);
  assert.ok(html.includes('content="'+base+relative+'"'),"OG URL incorrect: "+relative);
  assert.match(html,/<h1[^>]*>/);
  const schema=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(schema.length,"missing JSON-LD "+relative);
  for(const m of schema)assert.doesNotThrow(()=>JSON.parse(m[1]));
  const title=html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.ok(title&&title.length>20,"missing title "+relative);
  assert.ok(!titles.has(title),"duplicate title "+relative);titles.add(title);
  const assets=[...html.matchAll(/(?:src|href)="(\.\.\/assets\/[^"]+)"/g)];
  for(const match of assets){
   const disk=path.resolve(root,"discover",match[1]);
   assert.ok(fs.existsSync(disk),"broken image link "+relative+": "+match[1]);
  }
 }
});
test("public site links to crawlable directory and all new pages",()=>{
 const index=read("discover/index.html");
 for(const relative of urls.filter(x=>x.startsWith("discover/")&&x.endsWith(".html"))){
  assert.ok(index.includes('href="./'+relative.slice("discover/".length)+'"'),
   "missing directory link: "+relative);
 }
 assert.match(read("index.html"),/href="\.\/discover\/"/);
 assert.match(read("index.html"),/<meta name="robots" content="index,follow/);
 assert.match(read("admin.html"),/<meta name="robots" content="noindex"/);
});
test("project-level robots file documents real scope and sitemap link",()=>{
 const robots=read("robots.txt");
 assert.match(robots,/Sitemap: https:\/\/f90-card\.github\.io\/f90-card-f90-card\/sitemap\.xml/);
 assert.match(robots,/crawler-wide robots directives apply only from the domain root/);
 assert.ok(!robots.includes("Disallow: /"));
});
