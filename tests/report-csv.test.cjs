const test = require("node:test");
const assert = require("node:assert/strict");
const { historyCSV } = require("../reports.js");

test("CSV exports Arabic headings and escapes spreadsheet formulas", () => {
  const csv = historyCSV("ledger", [{
    description: '=HYPERLINK("https://example.invalid")',
    amount_usd: -2.5,
    balance_after: 7.5,
    created_at: "2026-10-13T00:00:00Z",
    id: "row-1",
  }]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"البيان","الحركة بالدولار"/);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example.invalid""\)"/);
  assert.match(csv, /"'-2\.5"/);
  assert.match(csv, /"row-1"/);
});

test("staff ledger CSV includes customer, balances, and safe references", () => {
  const csv = historyCSV("staff-ledger", [{
    customer_name: "=1+1",
    customer_id: "F901",
    kind: "refund",
    amount_usd: 5,
    balance_before: 10,
    balance_after: 15,
    reference_id: "@attack",
    description: "رد",
    created_at: "2026-10-13T00:00:00Z",
    id: "row-2",
  }]);
  assert.match(csv, /"العميل","رقم العميل","نوع الحركة"/);
  assert.match(csv, /"'=1\+1"/);
  assert.match(csv, /"'@attack"/);
  assert.match(csv, /"10","15"/);
});
