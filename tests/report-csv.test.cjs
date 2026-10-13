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
