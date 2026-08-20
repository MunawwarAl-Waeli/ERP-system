import { database } from "@core/database";
import ReceiptVoucher from "@core/database/models/ReceiptVoucher";
import SalesInvoice from "@core/database/models/SalesInvoice";
import PaymentAllocation from "@core/database/models/PaymentAllocation";
import { Q } from "@nozbe/watermelondb";
import { ReceiptAccountingService } from "@core/services/ReceiptAccountingService";

const receiptVouchersCollection =
  database.get<ReceiptVoucher>("receipt_vouchers");
const salesInvoicesCollection = database.get<SalesInvoice>("sales_invoices");
const paymentAllocationsCollection = database.get<PaymentAllocation>(
  "payment_allocations",
);

export const receiptVoucherRepository = {
  /**
   * إنشاء سند قبض وتوزيع المبلغ تلقائياً على فواتير العميل الآجلة (FIFO)
   */
  createAndAllocateToCustomer: (data: {
    voucherNumber: string;
    voucherDate: Date;
    paymentAccountId: string;
    customerId: string;
    amount: number;
    description?: string;
    createdBy: string;
  }) =>
    database.write(async () => {
      // 1. إنشاء سند القبض
      const voucher = await receiptVouchersCollection.create((v) => {
        v.voucherNumber = data.voucherNumber;
        v.voucherDate = data.voucherDate;
        v.paymentAccountId = data.paymentAccountId;
        v.amount = data.amount;
        v.description = data.description ?? `سند قبض - سداد حساب العميل`;
        v.referenceType = "customers";
        v.referenceId = data.customerId;
        v.status = "posted"; // معتمد فوراً
        v.createdBy = data.createdBy;
      });

      // 2. جلب فواتير العميل غير المدفوعة أو المدفوعة جزئياً (مرتبة من الأقدم إلى الأحدث)
      const unpaidInvoices = await salesInvoicesCollection
        .query(
          Q.where("customer_id", data.customerId),
          Q.where("status", Q.oneOf(["approved", "partial"])),
          Q.sortBy("invoice_date", Q.asc),
        )
        .fetch();

      let remainingPayment = data.amount;

      // 3. التوزيع الآلي للمبلغ على الفواتير (FIFO)
      for (const invoice of unpaidInvoices) {
        if (remainingPayment <= 0) {
          break;
        }
        const p = invoice.paidAmount ?? 0;
        const unpaidOnInvoice = Math.max(invoice.total - p, 0);
        if (unpaidOnInvoice <= 0) {
          continue;
        }

        // المبلغ الذي سيتم تخصيصه لهذه الفاتورة
        const allocationForThisInvoice = Math.min(
          remainingPayment,
          unpaidOnInvoice,
        );

        // أ) إنشاء كائن تخصيص الدفعة (PaymentAllocation)
        await paymentAllocationsCollection.create((pa) => {
          pa.receiptVoucherId = voucher.id;
          pa.allocatableType = "sales_invoice";
          pa.allocatableId = invoice.id;
          pa.amount = allocationForThisInvoice;
        });

        // ب) تحديث المبلغ المدفوع وحالة الفاتورة مباشرة
        const paid = invoice.paidAmount ?? 0;
        const newPaidAmount = paid + allocationForThisInvoice;
        await invoice.update((inv) => {
          inv.paidAmount = newPaidAmount;
          inv.status = newPaidAmount >= inv.total ? "paid" : "partial";
        });

        // ج) خصم المتبقي من مبلغ السند
        remainingPayment -= allocationForThisInvoice;
      }

      // 4. إنشاء القيد المحاسبي لسند القبض
      await ReceiptAccountingService.createReceiptEntry(voucher);

      return voucher;
    }),

  /**
   * مراقبة كل سندات القبض
   */
  observeAll: () =>
    receiptVouchersCollection.query(Q.sortBy("voucher_date", Q.desc)).observe(),

  /**
   * مراقبة سند معين
   */
  observeById: (id: string) => receiptVouchersCollection.findAndObserve(id),

  /**
   * إلغاء السند
   */
  cancel: (id: string) =>
    database.write(async () => {
      const voucher = await receiptVouchersCollection.find(id);

      await voucher.update((item) => {
        item.status = "cancelled";
      });

      return voucher;
    }),

  /**
   * حذف سند مسودة فقط
   */
  deleteDraft: (id: string) =>
    database.write(async () => {
      const voucher = await receiptVouchersCollection.find(id);

      if (voucher.status !== "draft") {
        throw new Error("لا يمكن حذف سند معتمد أو ملغى");
      }

      await voucher.markAsDeleted();
    }),
};
