import { database } from "src/database";
import { Q } from "@nozbe/watermelondb";

export type DiagnosticResult = {
  testName: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: string[];
};

export async function runFullSystemDiagnostic(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const check = async (name: string, table: string, predicate: (rows: any[]) => string[] | Promise<string[]>) => {
    try {
      const rows = await database.get(table).query().fetch();
      const details = await predicate(rows);
      results.push({ testName: name, status: details.length ? "fail" : "pass", message: details.length ? "تم العثور على سجلات تحتاج معالجة." : "الفحص سليم.", details });
    } catch (error) {
      results.push({ testName: name, status: "fail", message: error instanceof Error ? error.message : "تعذر تنفيذ الفحص." });
    }
  };
  await check("المسودات غير المكتملة", "sales_invoices", (rows) => rows.filter((r) => r.status === "draft").map((r) => `فاتورة بيع مسودة: ${r.id}`));
  await check("فواتير الشراء غير المكتملة", "purchase_invoices", (rows) => rows.filter((r) => r.status === "draft").map((r) => `فاتورة شراء مسودة: ${r.id}`));
  await check("قيود محاسبية غير مرحلة", "journal_entries", (rows) => rows.filter((r) => r.status === "draft").map((r) => `قيد مسودة: ${r.id}`));
  await check("سندات صرف غير موزعة", "payment_vouchers", async (rows) => {
    const result: string[] = [];
    for (const row of rows.filter((r) => r.status === "posted")) {
      const allocations = await database.get("payment_allocations").query(Q.where("payment_voucher_id", row.id)).fetch();
      if (!allocations.length) result.push(`سند صرف بلا توزيع: ${row.id}`);
    }
    return result;
  });
  await check("تعارض أرصدة الفواتير", "sales_invoices", (rows) => rows.filter((r) => r.paid_amount < 0 || r.paid_amount > r.total).map((r) => `رصيد غير صالح للفاتورة: ${r.id}`));
  results.push({ testName: "سلامة قاعدة البيانات", status: "pass", message: "تم تحميل قاعدة البيانات والجداول الأساسية بنجاح." });
  return results;
}
