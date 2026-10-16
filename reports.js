(function (root) {
  "use strict";
  const C = root.F90Core;
  let library, fontData, logoData;
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
    if(logoData===undefined){
      logoData=null;
      try{
        const response=await fetch(new URL("./assets/icons/icon-192.png",location.href));
        if(response.ok){
          const bytes=new Uint8Array(await response.arrayBuffer());
          let buffer="";
          for(let i=0;i<bytes.length;i+=16384)
            buffer+=String.fromCharCode(...bytes.subarray(i,i+16384));
          logoData="data:image/png;base64,"+btoa(buffer);
        }
      }catch{/* The PDF keeps its F90 typographic branding without an image. */}
    }
    return { Constructor: root.jspdf.jsPDF, font: fontData, logo: logoData };
  }
  function createReport(Constructor, font, title, store, rows, notes = [], logo = null) {
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
      doc.setFillColor(186, 27, 58);
      doc.rect(0, 40, 210, 3, "F");
      doc.rect(196, 0, 4, 40, "F");
      if(logo)try{doc.addImage(logo,"PNG",15,9,24,24);}catch{/* Typography remains visible. */}
      doc.setFontSize(8);
      doc.setTextColor(235, 123, 140);
      doc.text("F90 CARD",48,23);
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
    for (const [index, [label, value]] of rows.entries()) {
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
      if(index%2===0)doc.setFillColor(246,247,250);
      else doc.setFillColor(251,250,251);
      doc.roundedRect(15,y,180,height,2,2,"F");
      doc.setFillColor(186,27,58);
      doc.rect(193,y,2,height,"F");
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
    const { Constructor, font, logo } = await load();
    const doc = createReport(Constructor, font, title, store, rows, notes, logo);
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
  function historyCSV(kind, items) {
    const columns = kind === "staff-ledger"
      ? [["created_at", "التاريخ"], ["customer_name", "العميل"], ["customer_id", "رقم العميل"], ["kind", "نوع الحركة"], ["amount_usd", "الحركة بالدولار"], ["balance_before", "الرصيد قبل"], ["balance_after", "الرصيد بعد"], ["reference_id", "المرجع"], ["description", "البيان"], ["id", "المعرف"]]
      : kind === "orders"
      ? [["order_number", "رقم الطلب"], ["product_name", "الخدمة"], ["quantity", "الكمية"], ["status", "الحالة"], ["total_usd", "الإجمالي بالدولار"], ["created_at", "التاريخ"], ["id", "المعرف"]]
      : kind === "deposits"
        ? [["method_name", "طريقة الإيداع"], ["amount", "المبلغ"], ["currency", "العملة"], ["usd_amount", "المبلغ بالدولار"], ["status", "الحالة"], ["created_at", "التاريخ"], ["id", "المعرف"]]
        : [["description", "البيان"], ["amount_usd", "الحركة بالدولار"], ["balance_after", "الرصيد بعدها"], ["created_at", "التاريخ"], ["id", "المعرف"]];
    const cell = (value) => {
      let text = String(value ?? "");
      // Spreadsheet applications can execute formulas from imported CSV cells.
      if (/^[\s\x00-\x1f]*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [columns.map(([, heading]) => heading), ...(items || []).map((item) => columns.map(([key]) => item[key]))];
    const csv = "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
    return csv;
  }
  function downloadHistoryCSV(kind, items) {
    const blob = new Blob([historyCSV(kind, items)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "F90-" + kind + "-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
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
    order: (o, store, summaryRows) => {
      const qty=Number(o.quantity)||0;
      const amount=qty>0?Number(o.subtotal_usd||o.total_usd)/qty:0;
      const standard=[
        ["رقم العملية",o.order_number||o.id],
        ["اسم المنتج",o.product_name],
        ["الكمية",o.quantity],
        ["السعر",C.money(amount,"USD",true)],
        ["السعر الإجمالي",C.money(o.total_usd,"USD",true)],
        ["التاريخ والوقت",C.date(o.created_at)]
      ];
      const extras=(Array.isArray(summaryRows)?summaryRows:[]).filter(([key])=>
        ["ID الشحن","اسم الحساب المسجل"].includes(key));
      return save("ملخص العملية #"+o.order_number,store,
        [...(Array.isArray(summaryRows)?summaryRows.slice(0,6):standard),...extras,
        ["الحالة",C.statuses[o.status]||o.status]],
        ["F90 CARD | ملخص العملية من سجلك الشخصي. اسم الحساب يظهر فقط إذا كان مسجلًا في تفاصيل الطلب."]);
    },
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
          : kind === "ledger"
            ? save("السجل المالي", store, items.flatMap((x) => [
                ["العميل", (x.customer?.display_name || "") + " · " + (x.customer?.customer_id || "")],
                ["التاريخ", C.date(x.created_at)],
                ["الحركة", ({ deposit: "إيداع", purchase: "شراء", refund: "استرداد", adjustment: "تسوية" })[x.kind] || x.kind],
                ["المبلغ", C.money(x.amount_usd)],
                ["الرصيد بعد", C.money(x.balance_after)],
                ["المرجع", x.reference_id || x.id],
              ]), ["سجلات الصفحة الحالية فقط."])
            : save(
              "سجل الإدارة: " + (kind === "orders" ? "الطلبات" : "الإيداعات"),
              store,
              recordRows(kind, items),
              ["سجلات الصفحة الحالية فقط."],
            ),
    createReport,
    historyCSV,
    downloadHistoryCSV,
  };
  root.F90Reports = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

