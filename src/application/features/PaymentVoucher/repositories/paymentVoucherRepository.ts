import { documentNumberGenerator } from "@application/compositionRoot";
import { database } from "src/database";
import PaymentVoucher from "src/database/models/PaymentVoucher";
import PaymentAllocation from "src/database/models/PaymentAllocation";
import PurchaseInvoice from "src/database/models/PurchaseInvoice";
import JournalEntry from "src/database/models/JournalEntry";
import { Q } from "@nozbe/watermelondb";
import { AccountingSettingsService } from "@core/services/AccountingSettingsService";
import { JournalService } from "@core/services/JournalService";

const vouchers = database.get<PaymentVoucher>(PaymentVoucher.table);
const allocations = database.get<PaymentAllocation>(PaymentAllocation.table);
const invoices = database.get<PurchaseInvoice>(PurchaseInvoice.table);
const entries = database.get<JournalEntry>(JournalEntry.table);

export const paymentVoucherRepository = {
  observeAll: () => vouchers.query(Q.sortBy("voucher_date", Q.desc)).observe(),
  getDetails: async (id: string) => ({
    voucher: await vouchers.find(id),
    allocations: await allocations.query(Q.where("payment_voucher_id", id)).fetch(),
    entries: await entries.query(Q.where("reference_type", "payment_voucher"), Q.where("reference_id", id)).fetch(),
  }),
  cancel: (id: string) =>
    database.write(async () => {
      const voucher = await vouchers.find(id);
      if (voucher.isCancelled || voucher.status === "cancelled") {
        throw new Error("لا يمكن إلغاء سند صرف ملغى مسبقًا.");
      }
      if (voucher.status !== "posted") {
        throw new Error("يمكن إلغاء السندات المرحلة فقط.");
      }
      const rows = await allocations.query(Q.where("payment_voucher_id", id)).fetch();
      const operations = [] as any[];
      for (const row of rows) {
        const invoice = await row.purchaseInvoice.fetch();
        operations.push(
          (invoice as any).prepareUpdate((record: any) => {
            record.paidAmount = Math.max(record.paidAmount - row.amount, 0);
          }),
        );
      }
      const original = await entries
        .query(Q.where("reference_type", "payment_voucher"), Q.where("reference_id", id))
        .fetch();
      if (original[0] && original[0].status === "posted" && !original[0].isReversed) {
        const reversal = await JournalService.prepareReverseEntry(
          original[0],
          `عكس سند صرف رقم ${voucher.voucherNumber ?? voucher.id}`,
          { createdBy: voucher.createdBy, idempotencyKey: `payment-voucher-reversal:${id}` },
          Date.now(),
        );
        operations.push(...reversal.operations);
      }
      operations.push(
        voucher.prepareUpdate((record) => {
          record.status = "cancelled";
          record.isCancelled = true;
          record.cancelledAt = Date.now();
        }),
      );
      await database.batch(...operations);
      return voucher;
    }),
  createAndAllocateToSupplier: async (data: {
    voucherNumber: string;
    voucherDate: Date;
    paymentAccountId: string;
    supplierId: string;
    amount: number;
    description?: string;
    createdBy: string;
  }) => {
    if (!data.paymentAccountId?.trim() || !data.supplierId?.trim()) throw new Error("حساب الدفع والمورد مطلوبان.");
    if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error("قيمة السداد يجب أن تكون أكبر من صفر.");
    const dateStr = data.voucherDate.toISOString().slice(0, 10);
    const officialNumber =
      !data.voucherNumber || data.voucherNumber.startsWith("PAY-")
        ? await documentNumberGenerator.generate("PV", dateStr)
        : data.voucherNumber;
    return database.write(async () => {
      const supplierInvoices = await invoices.query(
        Q.where("supplier_id", data.supplierId),
        Q.where("status", "posted"),
        Q.where("is_cancelled", false),
        Q.sortBy("invoice_date", Q.asc),
      ).fetch();
      let remaining = data.amount;
      const plan: Array<{ invoice: PurchaseInvoice; amount: number }> = [];
      for (const invoice of supplierInvoices) {
        const outstanding = Math.max(invoice.total - invoice.paidAmount, 0);
        if (!outstanding) continue;
        const amount = Math.min(remaining, outstanding);
        plan.push({ invoice, amount });
        remaining -= amount;
        if (remaining <= 0) break;
      }
      if (remaining > 0) throw new Error("قيمة السداد تتجاوز الرصيد المستحق للمورد.");
      const voucher = await vouchers.create((record) => {
        record.voucherNumber = officialNumber;
        record.voucherDate = data.voucherDate.getTime();
        record.paymentAccount.id = data.paymentAccountId;
        record.supplier.id = data.supplierId;
        record.amount = data.amount;
        record.description = data.description ?? null;
        record.status = "posted";
        record.createdBy = data.createdBy;
        record.isCancelled = false;
      });
      const operations = plan.flatMap(({ invoice, amount }) => [
        allocations.prepareCreate((record) => {
          record.paymentVoucher.set(voucher);
          record.purchaseInvoice.set(invoice);
          record.amount = amount;
        }),
        (invoice as any).prepareUpdate((record: any) => { record.paidAmount += amount; }),
      ]);
      await database.batch(...operations);
      const settings = await AccountingSettingsService.getSettings();
      const journalOperations = await JournalService.prepareCreateEntry({
        entryDate: data.voucherDate.getTime(),
        description: data.description || `سند صرف رقم ${officialNumber}`,
        referenceType: "payment_voucher",
        referenceId: voucher.id,
        createdBy: data.createdBy || "local-user",
        idempotencyKey: `payment-voucher:${voucher.id}`,
        lines: [
          { accountId: settings.suppliersAccountId, debit: data.amount, credit: 0 },
          { accountId: data.paymentAccountId, debit: 0, credit: data.amount },
        ],
      });
      await database.batch(...journalOperations);
      return voucher;
    });
  },
};
