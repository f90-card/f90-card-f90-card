(function (root) {
  "use strict";
  const C = root.F90Core;
  let library, fontData;
  async function load() {
    if (!root.jspdf) {
      if (!library)
        library = new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = new URL(
            "./assets/vendor/jspdf.umd.min.js",
            location.href,
          ).href;
          s.onload = resolve;
          s.onerror = () => reject(new Error("تعذّر تحميل أداة التقارير"));
          document.head.append(s);
        });
      await library;
    }
    if (!fontData) {
      const response = await fetch(
        new URL("./assets/fonts/DejaVuSans.ttf", location.href),
      );
      if (!response.ok) throw new Error("تعذّر تحميل الخط العربي");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let str = "";
      for (let n = 0; n < bytes.length; n += 16384)
        str += String.fromCharCode(...bytes.subarray(n, n + 16384));
      fontData = btoa(str);
    }
    return { Constructor: root.jspdf.jsPDF, font: fontData };
  }
  function createReport(Constructor, font, title, store, rows, notes = []) {
    const doc = new Constructor({
      unit: "mm",
      format: "a4",
      compress: true,
      putOnlyUsedFonts: true,
    });
    doc.addFileToVFS("F90Arabic.ttf", font);
    doc.addFont("F90Arabic.ttf", "F90Arabic", "normal");
    doc.setFont("F90Arabic");
    doc.setR2L(false);
    doc.setProperties({ title, author: store, subject: "تقرير أف تسعين كارد" });
    let y = 18,
      page = 0;
    function heading() {
      page++;
      doc.setFillColor(14, 18, 27);
      doc.rect(0, 0, 210, 43, "F");
      doc.setFillColor(232, 36, 65);
      doc.rect(196, 0, 4, 43, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(17);
      doc.text(String(store || "أف تسعين كارد"), 190, 15, { align: "right" });
      doc.setFontSize(12);
      doc.text(title, 190, 25, { align: "right" });
      doc.setTextColor(180, 188, 200);
      doc.setFontSize(8);
      doc.text(
        "تاريخ التقرير: " +
          C.date(new Date()).replace(
            /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
            "",
          ),
        190,
        35,
        { align: "right" },
      );
      y = 54;
      doc.setTextColor(30, 34, 42);
    }
    function newPage() {
      doc.setFontSize(8);
      doc.setTextColor(110, 116, 126);
      doc.text("أف تسعين كارد · صفحة " + page, 190, 286, { align: "right" });
      doc.addPage();
      heading();
    }
    heading();
    for (const [label, value] of rows) {
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(
        String(value ?? "—").replace(
          /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
          "",
        ),
        128,
      );
      const height = Math.max(15, lines.length * 5 + 8);
      if (y + height > 276) newPage();
      doc.setFillColor(246, 247, 250);
      doc.roundedRect(15, y, 180, height, 2, 2, "F");
      doc.setTextColor(128, 132, 142);
      doc.setFontSize(9);
      const labelLines = doc.splitTextToSize(String(label), 40);
      doc.text(labelLines, 190, y + 6, { align: "right" });
      doc.setTextColor(29, 33, 41);
      doc.setFontSize(10);
      doc.text(lines, 141, y + 6, { align: "right" });
      y += height + 3;
    }
    for (const note of notes) {
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(String(note), 176);
      if (y + lines.length * 5 > 275) newPage();
      doc.setTextColor(112, 116, 124);
      doc.text(lines, 190, y + 5, { align: "right" });
      y += lines.length * 5 + 10;
    }
    doc.setFontSize(8);
    doc.setTextColor(110, 116, 126);
    doc.text("أف تسعين كارد · صفحة " + page, 190, 286, { align: "right" });
    return doc;
  }
  async function save(title, store, rows, notes = []) {
    const { Constructor, font } = await load();
    const doc = createReport(Constructor, font, title, store, rows, notes);
    doc.save("F90-" + new Date().toISOString().slice(0, 10) + ".pdf");
  }
  const recordRows = (kind, items) =>
    items.flatMap((r, n) =>
      kind === "orders" || r.product_name
        ? [
            [`طلب ${r.order_number || n + 1}`, r.product_name],
            ["الحالة", C.statuses[r.status] || r.status],
            [
              "القيمة والكمية",
              C.money(r.total_usd) + " · " + r.quantity + " وحدة",
            ],
            ["وقت التقديم", C.date(r.created_at)],
          ]
        : kind === "deposits" || r.method_name
          ? [
              [`إيداع ${n + 1}`, r.method_name],
              ["القيمة الأصلية", C.money(r.amount, r.currency, true)],
              ["القيمة بالدولار", C.money(r.usd_amount, "USD", true)],
              ["الحالة", C.statuses[r.status]],
              ["وقت التقديم", C.date(r.created_at)],
            ]
          : [
              ["الحركة " + (n + 1), r.description],
              ["القيمة", C.money(r.amount_usd, "USD", true)],
              ["الرصيد بعدها", C.money(r.balance_after, "USD", true)],
              ["التاريخ", C.date(r.created_at)],
            ],
    );
  const api = {
    history: (kind, items, store) =>
      save(
        kind === "orders"
          ? "سجل الطلبات"
          : kind === "deposits"
            ? "سجل الإيداعات"
            : "كشف المحفظة",
        store,
        recordRows(kind, items || []),
        ["يتضمن هذا الملف سجلات الصفحة الحالية فقط. الرصيد المرجعي بالدولار."],
      ),
    order: (o, store) =>
      save("تفاصيل الطلب #" + o.order_number, store, [
        ["الخدمة", o.product_name],
        ["الحالة", C.statuses[o.status]],
        ["المبلغ المدفوع", C.money(o.total_usd, "USD", true)],
        ["الاسترداد", C.money(o.refunded_usd, "USD", true)],
        ["الكمية", o.quantity],
        ["التنفيذ", o.fulfillment === "automatic" ? "آلي" : "يدوي"],
        ["التقديم", C.date(o.created_at)],
        ["الإكمال", C.date(o.completed_at)],
        ["المدة", C.duration(o)],
        ...Object.entries(o.customer_fields || {}).map(([k, v]) => [
          k === "account_id" ? "معرّف الحساب" : k,
          v,
        ]),
      ]),
    admin: (r, store) =>
      save(
        "التقرير الشهري " + r.month,
        store,
        [
          ["إيراد الخدمات المكتملة", C.money(r.revenue_usd)],
          ["هامش الطلبات ذات التكلفة", C.money(r.known_profit_usd)],
          ["تكلفة مسجّلة", C.money(r.known_cost_usd)],
          ["طلبات بدون تكلفة مسجّلة", r.unpriced_cost_orders],
          ["العملاء", r.users],
          ["النشطون خلال ٣٠ يومًا", r.active_30d],
          ["طلبات الشهر", r.orders],
          ["رصيد العملاء الحالي", C.money(r.wallet_liability)],
          ...(r.leaderboard || []).map((u, n) => [
            "المتصدر " + (n + 1),
            u.display_name + " · " + C.money(u.spent_usd),
          ]),
        ],
        [
          "الفترة بحسب توقيت فلسطين وشهر إكمال الخدمة. هامش الربح لا يشمل الطلبات ذات التكلفة المجهولة أو مصاريف خارج النظام. أرصدة العملاء التزام محفظة.",
        ],
      ),
    staff: (kind, items, store) =>
      kind === "users"
        ? save(
            "سجل العملاء",
            store,
            items.flatMap((u) => [
              ["العميل", u.display_name + " · " + u.customer_id],
              ["البريد", u.email],
              [
                "الصلاحية والحالة",
                (C.roles[u.role] || "") + " · " + C.statuses[u.account_status],
              ],
              ["المحفظة", C.money(u.balance_usd)],
            ]),
          )
        : kind === "verification"
          ? save(
              "سجل طلبات التوثيق",
              store,
              items.flatMap((v) => [
                ["العميل", v.customer?.display_name],
                ["حالة المراجعة", C.statuses[v.status]],
                ["التاريخ", C.date(v.created_at)],
              ]),
              ["لا يتضمن التقرير صور أو أرقام المستندات."],
            )
          : save(
              "سجل الإدارة: " + (kind === "orders" ? "الطلبات" : "الإيداعات"),
              store,
              recordRows(kind, items),
              ["سجلات الصفحة الحالية فقط."],
            ),
    createReport,
  };
  root.F90Reports = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
