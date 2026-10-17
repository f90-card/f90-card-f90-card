"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const canonical = "https://www.f90card.online/";

test("Google OAuth returns to canonical www root, never the old html entrypoint",()=>{
 const app=read("app.js");
 assert.match(app,/provider: "google",\s*options: \{ redirectTo: "https:\/\/www\.f90card\.online\/" \}/);
 assert.doesNotMatch(app,/provider: "google",\s*options: \{ redirectTo: new URL\("\.\/index\.html"/);
});

test("signup, reset and staff recovery all send safe callbacks to canonical origin",()=>{
 const app=read("app.js"),admin=read("admin.js");
 assert.match(app,/const redirect = "https:\/\/www\.f90card\.online\/"/);
 assert.match(app,/emailRedirectTo: redirect/);
 assert.match(app,/auth\.resetPasswordForEmail\(data\.email, \{\s*redirectTo: redirect,/);
 assert.match(admin,/redirect_to: "https:\/\/www\.f90card\.online\/"/);
 assert.match(app,/event === "PASSWORD_RECOVERY"/);
 assert.match(app,/location\.hash = "#\/reset"/);
 assert.match(admin,/location\.href = "https:\/\/www\.f90card\.online\/#\/auth"/);
});

test("branded recovery mail points to Supabase generated one-time URL, not a custom insecure token",()=>{
 const html=read("docs/email-templates/password-recovery-ar.html");
 assert.ok(html.includes("{{ .ConfirmationURL }}"));
 assert.ok(html.includes("F90 CARD"));
 assert.ok(html.includes(canonical));
 assert.doesNotMatch(html,/\bsecret(?:_key)?\s*=/i);
});
