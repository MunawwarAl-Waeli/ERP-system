/* eslint-disable arrow-body-style */
import {
  database,
  PaymentAllocation,
  PaymentVoucher,
  PurchaseInvoice,
} from "@core/database";
import Supplier from "@core/database/models/Supplier";
import { Q } from "@nozbe/watermelondb";
import { generateNumber } from "@shared/utils/id";
import { paymentVoucherRepository } from "@features/PaymentVoucher/repositories/paymentVoucherRepository";

const suppliersCollection = database.get<Supplier>("suppliers");
const purchaseInvoicesCollection =
  database.get<PurchaseInvoice>("purchase_invoices");
const paymentAllocationsCollection = database.get<PaymentAllocation>(
  "payment_allocations",
);
const paymentVouchersCollection =
  database.get<PaymentVoucher>("payment_vouchers");

export interface SupplierLedgerItem {
  id: string;
  date: Date;
  referenceNumber: string;
  type: "purchase_invoice" | "payment_voucher";
  description: string;
  debit: number; // مدين (سداد وسندات صرف تقلل المديونية)
  credit: number; // دائن (فواتير شراء تزيد المديونية للمورد)
  runningBalance: number; // الرصيد التراكمي للمورد
}

export const supplierRepository = {
  observeAll: () =>
    suppliersCollection.query(Q.sortBy("name", Q.asc)).observe(),

  observeById: (id: string) => suppliersCollection.findAndObserve(id),

  getById: (id: string) => suppliersCollection.find(id),

  create: (data: { name: string; phone?: string; address?: string }) =>
    database.write(() =>
      suppliersCollection.create((supplier) => {
        supplier.name = data.name;
        supplier.phone = data.phone || "";
        supplier.address = data.address || "";
      }),
    ),

  update: async (
    id: string,
    data: { name?: string; phone?: string; address?: string },
  ) => {
    const supplier = await suppliersCollection.find(id);
    return database.write(() =>
      supplier.update((s) => {
        if (data.name !== undefined) s.name = data.name;
        if (data.phone !== undefined) s.phone = data.phone;
        if (data.address !== undefined) s.address = data.address;
      }),
    );
  },

  /**
   * حساب رصيد المورد المستحق (إجمالي المشتريات ناقصاً المدفوعات)
   */
  getOutstandingBalance: async (supplierId: string): Promise<number> => {
    const invoices = await purchaseInvoicesCollection
      .query(
        Q.where("supplier_id", supplierId),
        Q.where("status", Q.notEq("cancelled")),
      )
      .fetch();

    let totalInvoices = 0;
    let totalPaid = 0;

    for (const invoice of invoices) {
      totalInvoices += invoice.total || 0;

      const allocations = await paymentAllocationsCollection
        .query(
          Q.where("allocatable_type", "purchase_invoices"),
          Q.where("allocatable_id", invoice.id),
        )
        .fetch();
      totalPaid += allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    }

    // رصيد المورد: فواتير المشتريات (دائن) ناقصاً المدفوعات (مدين)
    return totalInvoices - totalPaid;
  },

  /**
   * جلب كشف الحساب التفصيلي للمورد مرتباً زمنياً مع حساب الرصيد التراكمي (Running Balance)
   */
  getDetailedLedger: async (
    supplierId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<SupplierLedgerItem[]> => {
    // 1. جلب فواتير الشراء غير الملغاة (تعتبر دائن للمورد - تزيد الالتزام)
    const invoices = await purchaseInvoicesCollection
      .query(
        Q.where("supplier_id", supplierId),
        Q.where("status", Q.notEq("cancelled")),
      )
      .fetch();

    // 2. جلب سندات الصرف المرتبطة بالمورد (تعتبر مدين للمورد - تقلل الالتزام)
    const payments = await paymentVouchersCollection
      .query(
        Q.where("reference_type", "suppliers"),
        Q.where("reference_id", supplierId),
        Q.where("status", Q.notEq("cancelled")),
      )
      .fetch();

    // 3. توحيد الحركات في قائمة واحدة
    const rawTransactions: {
      id: string;
      date: Date;
      referenceNumber: string;
      type: "purchase_invoice" | "payment_voucher";
      description: string;
      debit: number;
      credit: number;
    }[] = [];

    for (const inv of invoices) {
      rawTransactions.push({
        id: inv.id,
        date: inv.invoiceDate || inv.createdAt,
        referenceNumber: inv.invoiceNumber || inv.id,
        type: "purchase_invoice",
        description: `فاتورة شراء رقم ${inv.invoiceNumber || inv.id}`,
        debit: 0,
        credit: inv.total || 0, // تزيد رصيد المورد (دائن)
      });
    }

    for (const pay of payments) {
      rawTransactions.push({
        id: pay.id,
        date: pay.voucherDate || pay.createdAt,
        referenceNumber: pay.voucherNumber || pay.id,
        type: "payment_voucher",
        description:
          pay.description || `سند صرف رقم ${pay.voucherNumber || pay.id}`,
        debit: pay.amount || 0, // تقلل رصيد المورد (مدين)
        credit: 0,
      });
    }

    // 4. الترتيب الزمني التصاعدي لحساب الرصيد التراكمي بدقة
    rawTransactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let runningBalance = 0;
    const ledgerWithBalance: SupplierLedgerItem[] = rawTransactions.map(
      (tx) => {
        // الرصيد التراكمي للمورد = الرصيد السابق + دائن (فواتير) - مدين (سندات صرف)
        runningBalance = runningBalance + tx.credit - tx.debit;
        return {
          ...tx,
          runningBalance,
        };
      },
    );

    // 5. تطبيق فلتر التاريخ إن وجد
    let filtered = ledgerWithBalance;
    if (startDate) {
      filtered = filtered.filter((tx) => new Date(tx.date) >= startDate);
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter((tx) => new Date(tx.date) <= endOfDay);
    }

    // 6. إعادة الترتيب تنازلياً للعرض (الأحدث أولاً) مع الحفاظ على سلامة الرصيد التراكمي
    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  },

  /**
   * إنشاء سند صرف للمورد وربطه آلياً بالفواتير المستحقة (FIFO) مع توليد القيد المحاسبي
   */
  addSupplierPayment: async (
    supplierId: string,
    amount: number,
    notes: string = "",
    createdBy: string = "system",
  ) => {
    if (amount <= 0) {
      throw new Error("مبلغ الدفع يجب أن يكون أكبر من الصفر");
    }

    return paymentVoucherRepository.createAndAllocateToSupplier({
      voucherNumber: generateNumber("PAY"),
      voucherDate: new Date(),
      paymentAccountId: "cash_account", // حساب الصندوق الافتراضي
      supplierId,
      amount,
      description: notes || "سند صرف سداد للمورد",
      createdBy,
    });
  },
};
