import { database } from "src/database";
import Customer from "src/database/models/Customer";
import SalesInvoice from "src/database/models/SalesInvoice";
import ReceiptVoucher from "src/database/models/ReceiptVoucher";
import { Q } from "@nozbe/watermelondb";
import { from, Observable, map, combineLatest } from "rxjs";
import {
  CreateCustomerInput,
  CustomerData,
  CustomerSearchInput,
  UpdateCustomerInput,
} from "@core/types/sales/customer";

export interface LedgerTransactionItem {
  id: string;
  type: "invoice" | "receipt";
  date: Date;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CreditEntry {
  id: string;
  entryType: "credit" | "payment";
  amount: number;
  balanceAfter: number;
  createdAt: Date;
  notes?: string;
}

export interface CustomerRepository {
  getById(id: string): Promise<CustomerData | null>;
  getByPhone(phone: string): Promise<CustomerData | null>;
  search(input: CustomerSearchInput): Promise<CustomerData[]>;
  getAll(): Promise<CustomerData[]>;
  getActive(): Promise<CustomerData[]>;
  create(input: CreateCustomerInput): Promise<CustomerData>;
  update(id: string, input: UpdateCustomerInput): Promise<CustomerData>;
}

const customers = database.get<Customer>(Customer.table);
const invoices = database.get<SalesInvoice>(SalesInvoice.table);
const receipts = database.get<ReceiptVoucher>(ReceiptVoucher.table);

const toData = (row: Customer): CustomerData => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  address: row.address,
  notes: row.notes,
  isActive: row.isActive,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// ==========================================
// دالة كشف الحساب التفصيلي
// ==========================================
export const getDetailedLedger = async (
  customerId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<LedgerTransactionItem[]> => {
  const invoiceRows = await invoices
    .query(
      Q.where("customer_id", customerId),
      Q.where("is_cancelled", false),
      Q.where("status", Q.notEq("draft")),
    )
    .fetch();

  const receiptRows = await receipts
    .query(
      Q.where("customer_id", customerId),
      Q.where("is_cancelled", false),
      Q.where("status", "posted"),
    )
    .fetch();

  const start = startDate?.getTime();
  const end = endDate?.getTime();
  const rows: Array<Omit<LedgerTransactionItem, "runningBalance">> = [];

  invoiceRows.forEach(
    (row: {
      invoiceDate: string | number | Date;
      id: any;
      invoiceNumber: any;
      total: any;
    }) => {
      const invoiceTime = new Date(row.invoiceDate).getTime();

      if (
        (start !== undefined && invoiceTime < start) ||
        (end !== undefined && invoiceTime > end)
      )
        return;

      rows.push({
        id: row.id,
        type: "invoice",
        date: new Date(invoiceTime),
        description: `فاتورة مبيعات ${row.invoiceNumber ?? row.id}`,
        debit: row.total || 0,
        credit: 0,
      });
    },
  );

  receiptRows.forEach(
    (row: {
      voucherDate: string | number | Date;
      id: any;
      voucherNumber: any;
      amount: any;
    }) => {
      const voucherTime = new Date(row.voucherDate).getTime();

      if (
        (start !== undefined && voucherTime < start) ||
        (end !== undefined && voucherTime > end)
      )
        return;

      rows.push({
        id: row.id,
        type: "receipt",
        date: new Date(voucherTime),
        description: `سند قبض ${row.voucherNumber ?? row.id}`,
        debit: 0,
        credit: row.amount || 0,
      });
    },
  );

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  return rows.map((row) => {
    balance += row.debit - row.credit;
    return { ...row, runningBalance: balance };
  });
};

export const customerRepository = {
  observeAll: () => customers.query(Q.sortBy("name", Q.asc)).observe(),

  search: (input: CustomerSearchInput | string) => {
    const value = typeof input === "string" ? input : input.search;
    const conditions: any[] = [];
    if (value?.trim()) {
      const pattern = `%${Q.sanitizeLikeString(value.trim())}%`;
      conditions.push(
        Q.or(
          Q.where("name", Q.like(pattern)),
          Q.where("phone", Q.like(pattern)),
        ),
      );
    }
    if (typeof input !== "string" && input.activeOnly)
      conditions.push(Q.where("is_active", true));
    return customers.query(...conditions, Q.sortBy("name", Q.asc)).observe();
  },

  observeById: (id: string) => customers.findAndObserve(id),

  getById: async (id: string) => customers.find(id).catch(() => null),

  getByPhone: async (phone: string) =>
    (await customers.query(Q.where("phone", phone), Q.take(1)).fetch())[0] ??
    null,

  getAll: async () => customers.query(Q.sortBy("name", Q.asc)).fetch(),

  getActive: async () =>
    customers
      .query(Q.where("is_active", true), Q.sortBy("name", Q.asc))
      .fetch(),

  create: async (input: CreateCustomerInput) =>
    database.write(() =>
      customers.create(
        (row: {
          name: string;
          phone: string;
          address: string | undefined;
          notes: string | undefined;
          isActive: boolean;
        }) => {
          row.name = input.name.trim();
          row.phone = input.phone.trim();
          row.address = input.address?.trim();
          row.notes = input.notes?.trim();
          row.isActive = input.isActive;
        },
      ),
    ),

  update: async (id: string, input: UpdateCustomerInput) => {
    return database.write(async () => {
      const row = await customers.find(id);
      return (row as any).update((record: any) => {
        record.name = input.name.trim();
        record.phone = input.phone.trim();
        record.address = input.address?.trim();
        record.notes = input.notes?.trim();
        record.isActive = input.isActive;
      });
    });
  },

  deactivate: async (id: string) => {
    return database.write(async () => {
      const row = await customers.find(id);
      return (row as any).update((record: any) => {
        record.isActive = false;
      });
    });
  },

  // ✅ دالة جلب الرصيد (مرة واحدة)
  getOutstandingBalance: async (id: string) => {
    const invRows = await invoices
      .query(
        Q.where("customer_id", id),
        Q.where("is_cancelled", false),
        Q.where("status", Q.notEq("draft")),
      )
      .fetch();
    const recRows = await receipts
      .query(
        Q.where("customer_id", id),
        Q.where("is_cancelled", false),
        Q.where("status", "posted"),
      )
      .fetch();
    const invTotal = invRows.reduce(
      (sum: any, r: { total: any }) => sum + (r.total || 0),
      0,
    );
    const recTotal = recRows.reduce(
      (sum: any, r: { amount: any }) => sum + (r.amount || 0),
      0,
    );
    return invTotal - recTotal;
  },

  // ✅ دالة مراقبة رصيد عميل محدد لحظياً عبر RxJS المباشر
  observeOutstandingBalance: (customerId: string): Observable<number> => {
    const invoicesQuery = invoices.query(
      Q.where("customer_id", customerId),
      Q.where("is_cancelled", false),
      Q.where("status", Q.notEq("draft")),
    );
    const receiptsQuery = receipts.query(
      Q.where("customer_id", customerId),
      Q.where("is_cancelled", false),
      Q.where("status", "posted"),
    );

    return combineLatest([
      invoicesQuery.observe(),
      receiptsQuery.observe(),
    ] as const).pipe(
      map(([invRows, recRows]): number => {
        const invTotal = invRows.reduce(
          (sum: any, r: { total: any }) => sum + (r.total || 0),
          0,
        );
        const recTotal = recRows.reduce(
          (sum: any, r: { amount: any }) => sum + (r.amount || 0),
          0,
        );
        return invTotal - recTotal;
      }),
    );
  },

  // ✅ دالة مراقبة خريطة الأرصدة لجميع العملاء لحظياً وبقراءة آمنة للحقول
  observeCreditsMap: (): Observable<Record<string, number>> => {
    return combineLatest<[SalesInvoice[], ReceiptVoucher[]]>([
      invoices.query().observe(),
      receipts.query().observe(),
    ]).pipe(
      map(([allInvoices, allReceipts]) => {
        const creditMap: Record<string, number> = {};

        allInvoices.forEach((inv: any) => {
          // قراءة آمنة لمعرف العميل والحالة والمبلغ من الموديل أو من _raw
          const customerId =
            inv.customerId || inv.customer_id || inv._raw?.customer_id;
          const isCancelled =
            inv.isCancelled ?? inv.is_cancelled ?? inv._raw?.is_cancelled;
          const status = inv.status ?? inv._raw?.status;
          const total = Number(inv.total ?? inv._raw?.total ?? 0);

          if (!isCancelled && status !== "draft" && customerId) {
            creditMap[customerId] = (creditMap[customerId] || 0) + total;
          }
        });

        allReceipts.forEach((rec: any) => {
          const customerId =
            rec.customerId || rec.customer_id || rec._raw?.customer_id;
          const isCancelled =
            rec.isCancelled ?? rec.is_cancelled ?? rec._raw?.is_cancelled;
          const status = rec.status ?? rec._raw?.status;
          const amount = Number(rec.amount ?? rec._raw?.amount ?? 0);

          if (!isCancelled && status === "posted" && customerId) {
            creditMap[customerId] = (creditMap[customerId] || 0) - amount;
          }
        });

        return creditMap;
      }),
    );
  },

  getOutstandingCredit: async (id: string) =>
    customerRepository.getOutstandingBalance(id),

  getDetailedLedger,

  getCreditEntries: (id: string) =>
    from(
      getDetailedLedger(id).then((rows) =>
        rows.map((row) => ({
          id: row.id,
          entryType:
            row.type === "invoice" ? ("credit" as const) : ("payment" as const),
          amount: row.debit || row.credit,
          balanceAfter: row.runningBalance,
          createdAt: row.date,
          notes: row.description,
        })),
      ),
    ),

  // ✅ دالة إضافة دفعة في الحساب (تسجيل سند قبض)
  addCreditPayment: async (
    customerId: string,
    amount: number,
    notes?: string,
  ) => {
    if (amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر.");

    return database.write(async () => {
      const now = new Date();
      const voucherDate = now.getTime();
      const voucherNumber = `RV-${voucherDate}`;

      const newReceipt = await receipts.create((record: any) => {
        if ("customerId" in record || record.customerId !== undefined) {
          record.customerId = customerId;
        } else if (record.customer) {
          record.customer.id = customerId;
        } else {
          record.customer_id = customerId;
        }
        record.amount = amount;
        record.voucherDate = voucherDate;
        record.voucherNumber = voucherNumber;
        record.status = "posted";
        record.description = notes?.trim() || "تحصيل دفعة من العميل";
        record.createdBy = "local-user";
        record.isCancelled = false;
        record.paymentAccountId = "";
      });

      return newReceipt;
    });
  },
};

export const customerDataRepository: CustomerRepository = {
  getById: async (id) => {
    const row = await customerRepository.getById(id);
    return row ? toData(row) : null;
  },
  getByPhone: async (phone) => {
    const row = await customerRepository.getByPhone(phone);
    return row ? toData(row) : null;
  },
  search: async (input) =>
    (await customerRepository.getAll())
      .filter(
        (row: { name: any; phone: any; isActive: any }) =>
          (!input.search ||
            `${row.name} ${row.phone}`
              .toLowerCase()
              .includes(input.search.toLowerCase())) &&
          (!input.activeOnly || row.isActive),
      )
      .map(toData),
  getAll: async () => (await customerRepository.getAll()).map(toData),
  getActive: async () => (await customerRepository.getActive()).map(toData),
  create: async (input) =>
    toData((await customerRepository.create(input)) as Customer),
  update: async (id, input) =>
    toData(await customerRepository.update(id, input)),
};
