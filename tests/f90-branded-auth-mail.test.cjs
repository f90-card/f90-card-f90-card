const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=path=>fs.readFileSync(path,"utf8");
test("all F90 transactional mail templates have secure canonical branding",()=>{
 for(const file of [
 "docs/email-templates/confirm-signup-ar.html",
 "docs/email-templates/welcome-after-confirmation-ar.html",
 "docs/email-templates/password-changed-ar.html",
 "docs/email-templates/password-recovery-ar.html"
 ]){
  const html=read(file);
  assert.match(html,/www\.f90card\.online/);
  assert.match(html,/F90 CARD/);
  assert.match(html,/lang="ar"/);
 }
});
test("mail auth flows never synthesize verification tokens",()=>{
 assert.match(read("docs/email-templates/confirm-signup-ar.html"),/\{\{ \.ConfirmationURL \}\}/);
 assert.match(read("docs/email-templates/password-recovery-ar.html"),/\{\{ \.ConfirmationURL \}\}/);
 const vercel=JSON.parse(read("vercel.json"));
 const paths=new Set(vercel.redirects.map(r=>r.source));
 assert.ok(paths.has("/docs/email-templates/:path*"));
});
