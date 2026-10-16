#!/usr/bin/env node
/**
 * Make a separated, unconfigured client copy of the F90 source tree.
 * This deliberately does NOT copy databases, provider credentials or customer
 * financial records. It never writes into the production repository.
 * Node.js 22+; run only from a local clone of template/white-label-starter.
 */
import {readFileSync,writeFileSync,existsSync,readdirSync,mkdirSync,cpSync} from "node:fs";
import {dirname,extname,isAbsolute,join,relative,resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const settingsPath=process.argv[2];
const outputPath=process.argv[3];
if(!settingsPath||!outputPath){
  console.error("Use: node scripts/create-client-store.mjs ./client.json ../client-store-export");
  process.exit(2);
}
const data=JSON.parse(readFileSync(resolve(settingsPath),"utf8"));
const need=["storeNameAr","storeNameEn","siteUrl","supportWhatsapp","supabaseUrl","supabasePublishableKey"];
for(const name of need){
  if(typeof data[name]!=="string"||!data[name].trim())throw Error("Missing value: "+name);
}
const site=new URL(data.siteUrl),sb=new URL(data.supabaseUrl);
if(site.protocol!=="https:"||sb.protocol!=="https:"||!sb.hostname.endsWith(".supabase.co"))
  throw Error("Production sites require HTTPS and a valid Supabase project URL.");
if(site.hostname.includes("f90-card")||sb.hostname.startsWith("xzqnrpycjxfbyrfaolud."))
  throw Error("A client copy must not use the F90 CARD production site or database.");
if(data.supabasePublishableKey.includes("YOUR_")||data.supabaseUrl.includes("NEW_PROJECT")||
   site.hostname.endsWith(".example"))
  throw Error("First replace the example credentials and domain with the client's own public values.");
if(/service[_-]?role|sb_secret_/i.test(data.supabasePublishableKey))
  throw Error("Never place a service_role/secret key in a browser configuration.");
const destination=resolve(outputPath);
if(destination===root||destination.startsWith(root+sep)||root.startsWith(destination+sep) ||
   destination===dirname(root)||destination===resolve("/"))
  throw Error("Output must be a new dedicated folder outside the source repository.");
if(existsSync(destination))throw Error("Output already exists; choose a new empty path.");

const unwanted=(rel)=>{
  const normalized=rel.split(sep).join("/");
  const parts=normalized.split("/");
  if(parts.some(x=>x===".git"||x==="node_modules"||x==="__pycache__"||x===".venv"))return true;
  if(parts.some(x=>x.startsWith(".env")||x.toLowerCase().includes("credentials")||
     x.toLowerCase().includes("private-key")))return true;
  // Historical F90 migrations and seeds may contain account-specific data
  // and cannot serve as an independently reviewed clean new-tenant baseline.
  if(normalized.startsWith("supabase/migrations")||normalized.startsWith("supabase/seeds"))return true;
  if(normalized.startsWith("white-label/client.")&&normalized!=="white-label/client.example.json")return true;
  return false;
};
cpSync(root,destination,{recursive:true,filter:(path)=>{
  const rel=relative(root,path);
  return !unwanted(rel);
}});
mkdirSync(join(destination,"supabase","migrations"),{recursive:true});
writeFileSync(join(destination,"supabase","migrations","README.md"),
 "STOP: The original F90 migrations were deliberately excluded. Create and test a clean tenant schema before deployment.\n");
const projectRef=sb.hostname.split(".")[0];
const substitutions=[
 ["https://f90-card.github.io/f90-card-f90-card/",site.href],
 ["https://f90-card.github.io/f90-card-f90-card",site.href.replace(/\/$/,"")],
 ["https://f90-card-f90-card.vercel.app",site.origin],
 ["f90-card.github.io/f90-card-f90-card",site.host+site.pathname.replace(/\/$/,"")],
 ["xzqnrpycjxfbyrfaolud",projectRef],
 ["+970568181910",data.supportWhatsapp],
 ["أف تسعين كارد",data.storeNameAr],
 ["F90 CARD",data.storeNameEn],
 ["F90 Card",data.storeNameEn]
];
const textTypes=new Set([".html",".js",".mjs",".cjs",".ts",".json",".webmanifest",".css",".xml",".svg",".md",".txt",".yml",".yaml",".toml",".webmanifest"]);
let edited=0,inspected=0;
function walk(dir){
  for(const ent of readdirSync(dir,{withFileTypes:true})){
    const file=join(dir,ent.name);
    if(ent.isDirectory()){walk(file);continue;}
    if(!ent.isFile()||!textTypes.has(extname(ent.name).toLowerCase()))continue;
    inspected++;
    let text=readFileSync(file,"utf8"),prior=text;
    for(const [a,b] of substitutions)text=text.split(a).join(b);
    if(text!==prior){writeFileSync(file,text);edited++;}
  }
}
walk(destination);
const configFile=join(destination,"config.js");
let cfg=readFileSync(configFile,"utf8");
const urlMatch=/(\bconst SUPABASE_URL\s*=\s*")[^"]+(")/;
const keyMatch=/(\bconst SUPABASE_PUBLISHABLE_KEY\s*=\s*")[^"]+(")/;
if(!urlMatch.test(cfg)||!keyMatch.test(cfg))throw Error("config.js format changed: validate manually before use");
cfg=cfg.replace(urlMatch,(_m,a,b)=>a+sb.href.replace(/\/$/,"")+b)
       .replace(keyMatch,(_m,a,b)=>a+data.supabasePublishableKey+b);
writeFileSync(configFile,cfg);
const guide=[
 "# نسخة عميل جديدة: قائمة تسليم إلزامية",
 "",
 "هذه نسخة نصوص/ملفات أولية وليست متجرًا جاهزًا لاستقبال الأموال.",
 "",
 "- [ ] استخدام قاعدة Supabase جديدة بالكامل، بلا حسابات أو محافظ F90 أو طلباته.",
 "- [ ] إنشاء مخطط نظيف ومراجعة صلاحيات RLS و SECURITY DEFINER قبل النشر.",
 "- [ ] تغيير شعار المتجر والصور والأيقونات والفيديوهات والبنرات التي تحمل F90.",
 "- [ ] مراجعة جميع النصوص والروابط الاجتماعية والمصادر الخارجية والهوية وSEO.",
 "- [ ] إعداد مدير العميل وحماية MFA والبريد والكرون والوظائف والمخازن.",
 "- [ ] إنشاء حسابات الموردين ومفاتيح API الخاصة بالعميل فقط، دون إعادة استخدام أسرار F90.",
 "- [ ] تثبيت الأسعار والعملات والعمولات وطرق الإيداع الخاصة بالعميل من جديد.",
 "- [ ] اختبار عمليات الإيداع والشراء ومراجعتها دون تنفيذ تحويل مالي حقيقي.",
 "- [ ] مراجعة ملكية وتراخيص الصور والمحتوى من أطراف ثالثة قبل البيع.",
 "- [ ] فحص عدم وجود مراجع لبيئة F90 الإنتاجية والانتقال لبيئة منفصلة.",
 "",
 "فُحص "+inspected+" ملفًا نصيًا، وعُدّل "+edited+" منها.",
 "المخططات القديمة وقاعدة بيانات العملاء لم تُنسخ. ملفات الشعار الأصلية ثنائية وليست قابلة لإعادة التسمية آليًا.",
 ""
].join("\n");
writeFileSync(join(destination,"CLIENT_REBRAND_CHECKLIST.md"),guide);
const remaining=[];
const oldBrand=/(?:أف تسعين|F90 CARD|F90 Card|f90-card\.github\.io|xzqnrpycjxfbyrfaolud)/;
function scan(dir){
 for(const ent of readdirSync(dir,{withFileTypes:true})){
  const file=join(dir,ent.name);
  if(ent.isDirectory()){scan(file);continue;}
  if(!ent.isFile()||!textTypes.has(extname(ent.name).toLowerCase()))continue;
  if(oldBrand.test(readFileSync(file,"utf8")))remaining.push(relative(destination,file));
 }
}
scan(destination);
writeFileSync(join(destination,"REMAINING_OLD_BRANDING.txt"),
 remaining.length?remaining.join("\n")+"\n":"No known text brand markers found. Manually inspect images, videos, URLs and provider connections.\n");
console.log("Separated client source created at "+destination);
console.log("Text files inspected: "+inspected+"; modified: "+edited+"; remaining text flags: "+remaining.length);
console.log("NOT READY TO SELL until all security, branding, database and media checks are complete.");
