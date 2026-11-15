import { documentNumberGenerator } from "@application/compositionRoot";
import { Q } from "@nozbe/watermelondb";
import { database } from "src/database";
import JournalEntry from "src/database/models/JournalEntry";
import ReceiptAllocation from "src/database/models/ReceiptAllocation";
import ReceiptVoucher from "src/database/models/ReceiptVoucher";
import SalesInvoice from "src/database/models/SalesInvoice";
import { DOCUMENT_STATUSES } from "@core/constants";
import { AccountingSettingsService } from "@core/services/AccountingSettingsService";
import { JournalService } from "@core/services/JournalService";

const vouchers = database.get<ReceiptVoucher>(ReceiptVoucher.table);
const allocations = database.get<ReceiptAllocation>(ReceiptAllocation.table);
const invoices = database.get<SalesInvoice>(SalesInvoice.table);
const entries = database.get<JournalEntry>(JournalEntry.table);

export const receiptVoucherRepository = {
  /** إنشاء سند قبض مرحل مع توزيع FIFO وقيد محاسبي ذري. */
  createAndAllocateToCustomer: async (data: {
    voucherNumber: string;
    voucherDate: Date;
    paymentAccountId: string;
    customerId: string;
    amount: number;
    description?: string;
    createdBy: string;
  }) => {
    const dateStr = data.voucherDate.toISOString().slice(0, 10);
    const officialNumber =
      !data.voucherNumber || data.voucherNumber.startsWith("REC-")
        ? await documentNumberGenerator.generate("RV", dateStr)
        : data.voucherNumber;
    return database.write(async () => {
      if (!data.paymentAccountId?.trim() || !data.customerId?.trim()) {
        throw new Error("حساب الدفع والعميل مطلوبان.");
      }
      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        throw new Error("قيمة سند القبض يجب أن تكون أكبر من صفر.");
      }
      const customerInvoices = await invoices
        .query(
          Q.where("customer_id", data.customerId),
          Q.where("status", DOCUMENT_STATUSES.POSTED),
          Q.where("is_cancelled", false),
          Q.sortBy("invoice_date", Q.asc),
          Q.sortBy("id", Q.asc),
        )
        .fetch();

      let remaining = data.amount;
      const plan: Array<{ invoice: SalesInvoice; amount: number }> = [];
      for (const invoice of customerInvoices) {
        const outstanding = Math.max(invoice.total - invoice.paidAmount, 0);
        if (outstanding <= 0) continue;
        const amount = Math.min(remaining, outstanding);
        plan.push({ invoice, amount });
        remaining -= amount;
        if (remaining <= 0) break;
      }
      if (remaining > 0) {
        throw new Error("قيمة السند تتجاوز الرصيد المستحق للعميل.");
      }

      const voucher = await vouchers.create((record) => {
        record.voucherNumber = officialNumber;
        record.voucherDate = data.voucherDate.getTime();
        record.paymentAccount.id = data.paymentAccountId;
        record.customer.id = data.customerId;
        record.amount = data.amount;
        record.description = data.description?.trim() || "سند قبض من العميل";
        record.status = DOCUMENT_STATUSES.POSTED;
        record.createdBy = data.createdBy || "local-user";
        record.idempotencyKey = `receipt:${officialNumber}`;
        record.isCancelled = false;
        record.cancelledAt = null;
      });

      const allocationRecords = plan.map(({ invoice, amount }) =>
        allocations.prepareCreate((record) => {
          record.receiptVoucher.set(voucher);
          record.salesInvoice.set(invoice);
          record.amount = amount;
        }),
      );
      const invoiceUpdates = plan.map(({ invoice, amount }) =>
        (invoice as any).prepareUpdate((record: any) => {
          record.paidAmount += amount;
        }),
      );
      await database.batch(...allocationRecords, ...invoiceUpdates);

      const settings = await AccountingSettingsService.getSettings();
      const journalOperations = await JournalService.prepareCreateEntry({
        entryDate: data.voucherDate.getTime(),
        description: data.description || `سند قبض رقم ${officialNumber}`,
        referenceType: "receipt_voucher",
        referenceId: voucher.id,
        createdBy: data.createdBy || "local-user",
        idempotencyKey: `receipt-voucher:${voucher.id}`,
        lines: [
          { accountId: data.paymentAccountId, debit: data.amount, credit: 0 },
          { accountId: settings.customersAccountId, debit: 0, credit: data.amount },
        ],
      });
      await database.batch(...journalOperations);
      return voucher;
    });
  },

  observeAll: () => vouchers.query(Q.sortBy("voucher_date", Q.desc)).observe(),
  observeById: (id: string) => vouchers.findAndObserve(id),

  getDetails: async (id: string) => {
    const voucher = await vouchers.find(id);
    const rows = await allocations
      .query(Q.where("receipt_voucher_id", id))
      .fetch();
    const journalEntries = await entries
      .query(Q.where("reference_type", "receipt_voucher"), Q.where("reference_id", id))
      .fetch();
    return { voucher, allocations: rows, entries: journalEntries };
  },

  /** إلغاء ذري لسند مرحل مع عكس القيد وإعادة Cache الفواتير. */
  cancel: (id: string) =>
    database.write(async () => {
      const voucher = await vouchers.find(id);
      if (voucher.isCancelled || voucher.status === DOCUMENT_STATUSES.CANCELLED) {
        throw new Error("لا يمكن إلغاء سند قبض ملغى مسبقًا.");
      }
      if (voucher.status !== DOCUMENT_STATUSES.POSTED) {
        throw new Error("يمكن إلغاء السندات المرحلة فقط.");
      }
      const rows = await allocations.query(Q.where("receipt_voucher_id", id)).fetch();
      const operations = [] as any[];
      for (const row of rows) {
        const invoice = await row.salesInvoice.fetch();
        operations.push(
          (invoice as any).prepareUpdate((record: any) => {
            record.paidAmount = Math.max(record.paidAmount - row.amount, 0);
          }),
        );
      }
      const original = await entries
        .query(Q.where("reference_type", "receipt_voucher"), Q.where("reference_id", id))
        .fetch();
      if (original[0]) {
        const reversal = await JournalService.prepareReverseEntry(
          original[0],
          `عكس سند قبض رقم ${voucher.voucherNumber ?? voucher.id}`,
          { createdBy: voucher.createdBy, idempotencyKey: `receipt-voucher-reversal:${id}` },
          Date.now(),
        );
        operations.push(...reversal.operations);
      }
      operations.push(
        voucher.prepareUpdate((record) => {
          record.status = DOCUMENT_STATUSES.CANCELLED;
          record.isCancelled = true;
          record.cancelledAt = Date.now();
        }),
      );
      await database.batch(...operations);
      return voucher;
    }),

  deleteDraft: (id: string) =>
    database.write(async () => {
      const voucher = await vouchers.find(id);
      if (voucher.status !== DOCUMENT_STATUSES.DRAFT) {
        throw new Error("لا يمكن حذف سند مرحل أو ملغى.");
      }
      await voucher.markAsDeleted();
    }),
};
