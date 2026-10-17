"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("storefront shows agents in navigation, footer, and public route", () => {
  const app = read("app.js");
  const html = read("index.html");
  assert.match(app, /\["agents", "وكلاؤنا", "user"\]/);
  assert.match(app, /else if \(page === "agents"\) await window\.F90Agents\.publicPage\(main\)/);
  assert.match(app, /<a href="#\/agents">وكلاؤنا<\/a>/);
  assert.match(html, /f90-agents\.js\?v=20261017-agents1/);
  assert.match(html, /f90-agents\.css\?v=20261017-agents1/);
});

test("admin includes management route and accessible agent form", () => {
  const admin = read("admin.js");
  const html = read("admin.html");
  const agents = read("f90-agents.js");
  assert.match(admin, /\["agents", "وكلاؤنا", "user", \["manager", "admin"\]\]/);
  assert.match(admin, /else if \(page === "agents"\) await window\.F90Agents\.adminPage\(main\)/);
  assert.match(html, /f90-agents\.js\?v=20261017-agents1/);
  for (const field of ['name="name"', 'name="phone"', 'name="location"', 'name="sort_order"', 'name="is_active"'])
    assert.ok(agents.includes(field), "missing form field " + field);
  for (const operation of [".insert(payload)", ".update(payload)", ".delete()", "data-agent-action"])
    assert.ok(agents.includes(operation), "missing CRUD operation " + operation);
});

test("public cards escape customer-provided data and show approved agents only", () => {
  const agents = read("f90-agents.js");
  assert.match(agents, /escapeHTML\(row\.name\)/);
  assert.match(agents, /escapeHTML\(row\.location\)/);
  assert.match(agents, /escapeHTML\(row\.phone\)/);
  assert.match(agents, /\.eq\("is_active", true\)/);
  assert.match(agents, /data-agent-action="toggle"/);
});

test("agent table row security restricts mutations and hidden agent reads", () => {
  const sql = read("supabase/migrations/20261017131500_f90_store_agents_directory.sql");
  assert.match(sql, /alter table public\.f90_store_agents enable row level security/);
  assert.match(sql, /for select to anon, authenticated using \(is_active\)/);
  assert.match(sql, /for insert to authenticated/);
  assert.match(sql, /for update to authenticated/);
  assert.match(sql, /for delete to authenticated/);
  assert.match(sql, /f90_private\.my_role\(\)/);
  assert.doesNotMatch(sql, /grant (?:insert|update|delete)[^\n]* to anon/i);
});
