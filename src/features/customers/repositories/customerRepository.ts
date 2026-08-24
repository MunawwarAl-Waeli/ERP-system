/* eslint-disable complexity */
/* eslint-disable require-await */
/* eslint-disable arrow-body-style */
import {
  database,
  PaymentAllocation,
  ReceiptVoucher,
  SalesInvoice,
} from "@core/database";
import Customer from "@core/database/models/Customer";
import { Q } from "@nozbe/watermelondb";
import { CustomerFormData } from "../schemas/customerSchema";
import { generateNumber } from "@shared/utils/id";
import { receiptVoucherRepository } from "@features/ReceiptVoucher/repositories/receiptVoucherRepository";

const customersCollection = database.get<Customer>("customers");
const salesInvoicesCollection = database.get<SalesInvoice>("sales_invoices");
const paymentAllocationsCollection = database.get<PaymentAllocation>(
  "payment_allocations",
);
const receiptVouchersCollection =
  database.get<ReceiptVoucher>("receipt_vouchers");

export interface LedgerTransactionItem {
  id: string;
  date: Date;
  referenceNumber: string;
  type: "invoice" | "receipt";
  description: string;
  debit: number; // مدين (عليه - فواتير)
  credit: number; // دائن (له - دفعات وسندات)
  runningBalance: number; // الرصيد التراكمي
}

export const customerRepository = {
  observeAll: () =>
    customersCollection
      .query(Q.where("is_active", true), Q.sortBy("name", Q.asc))
      .observe(),

  observeById: (id: string) => customersCollection.findAndObserve(id),

  search: (searchTerm: string) =>
    customersCollection
      .query(
        Q.where("is_active", true),
        Q.or(
          Q.where("name", Q.like(`%${Q.sanitizeLikeString(searchTerm)}%`)),
          Q.where("phone", Q.like(`%${Q.sanitizeLikeString(searchTerm)}%`)),
        ),
        Q.sortBy("name", Q.asc),
      )
      .observe(),

  getById: (id: string) => customersCollection.find(id),

  create: (data: CustomerFormData) =>
    database.write(() =>
      customersCollection.create((customer) => {
        customer.name = data.name;
        customer.phone = data.phone || "";
        customer.address = data.address || "";
        customer.notes = data.notes || "";
        customer.isActive = true;
      }),
    ),

  update: async (id: string, data: CustomerFormData) => {
    const customer = await customersCollection.find(id);
    return database.write(() =>
      customer.update((c) => {
        c.name = data.name;
        c.phone = data.phone || "";
        c.address = data.address || "";
        c.notes = data.notes || "";
      }),
    );
  },

  deactivate: async (id: string) => {
    const customer = await customersCollection.find(id);
    return database.write(() =>
      customer.update((c) => {
        c.isActive = false;
      }),
    );
  },

  // --- الدوال المالية والمحاسبية ---

  getOutstandingBalance: async (customerId: string): Promise<number> => {
    const invoices = await salesInvoicesCollection
      .query(
        Q.where("customer_id", customerId),
        Q.where("status", Q.notEq("cancelled")),
      )
      .fetch();

    let totalInvoices = 0;
    let totalPaid = 0;

    for (const invoice of invoices) {
      totalInvoices += invoice.total || 0;

      const allocations = await paymentAllocationsCollection
        .query(
          Q.where("allocatable_type", "sales_invoice"),
          Q.where("allocatable_id", invoice.id),
        )
        .fetch();
      totalPaid += allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    }

    return totalInvoices - totalPaid;
  },

  /**
   * جلب كشف الحساب التفصيلي للعميل مرتباً زمنياً مع حساب الرصيد التراكمي (Running Balance)
   */
  getDetailedLedger: async (
    customerId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<LedgerTransactionItem[]> => {
    // 1. جلب فواتير المبيعات غير الملغاة
    const invoiceQuery = [
      Q.where("customer_id", customerId),
      Q.where("status", Q.notEq("cancelled")),
    ];
    const invoices = await salesInvoicesCollection
      .query(...invoiceQuery)
      .fetch();

    // 2. جلب سندات القبض المرتبطة بالعميل
    const receipts = await receiptVouchersCollection
      .query(
        Q.where("reference_type", "customer"),
        Q.where("reference_id", customerId),
        Q.where("status", Q.notEq("cancelled")),
      )
      .fetch();

    // 3. توحيد الحركات في قائمة واحدة
    const rawTransactions: {
      id: string;
      date: Date;
      referenceNumber: string;
      type: "invoice" | "receipt";
      description: string;
      debit: number;
      credit: number;
    }[] = [];

    for (const inv of invoices) {
      rawTransactions.push({
        id: inv.id,
        date: inv.invoiceDate || inv.createdAt,
        referenceNumber: inv.invoiceNumber || inv.id,
        type: "invoice",
        description: `فاتورة مبيعات رقم ${inv.invoiceNumber || inv.id}`,
        debit: inv.total || 0,
        credit: 0,
      });
    }

    for (const rec of receipts) {
      rawTransactions.push({
        id: rec.id,
        date: rec.voucherDate || rec.createdAt,
        referenceNumber: rec.voucherNumber || rec.id,
        type: "receipt",
        description:
          rec.description || `سند قبض رقم ${rec.voucherNumber || rec.id}`,
        debit: 0,
        credit: rec.amount || 0,
      });
    }

    // 4. الترتيب الزمني التصاعدي لحساب الرصيد التراكمي بشكل صحيح
    rawTransactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let runningBalance = 0;
    const ledgerWithBalance: LedgerTransactionItem[] = rawTransactions.map(
      (tx) => {
        // الرصيد التراكمي = الرصيد السابق + المدين (عليه) - الدائن (له)
        runningBalance = runningBalance + tx.debit - tx.credit;
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

  addCustomerPayment: async (
    customerId: string,
    amount: number,
    notes: string = "",
    createdBy: string = "system",
  ) => {
    if (amount <= 0) {
      throw new Error("المبلغ يجب ان يكون اكبر من صفر");
    }
    return receiptVoucherRepository.createAndAllocateToCustomer({
      voucherNumber: generateNumber("REC"),
      voucherDate: new Date(),
      paymentAccountId: "cash_account", // استخدام معرف افتراضي للصندوق
      customerId,
      amount,
      description: notes || "دفعة من عميل",
      createdBy,
    });
  },

  getPaymentHistory: async (customerId: string) => {
    return receiptVouchersCollection
      .query(
        Q.where("reference_type", "customer"),
        Q.where("reference_id", customerId),
        Q.sortBy("voucher_date", Q.desc),
      )
      .fetch();
  },
};
