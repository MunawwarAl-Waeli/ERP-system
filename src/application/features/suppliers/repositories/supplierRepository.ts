import {
  CreateSupplierInput,
  SupplierData,
  UpdateSupplierInput,
} from "@core/types/suppliers/suppliers";
import { database } from "src/database";
import Supplier from "src/database/models/Supplier";
import PurchaseInvoice from "src/database/models/PurchaseInvoice";
import PaymentVoucher from "src/database/models/PaymentVoucher";
import AccountingSetting from "src/database/models/AccountingSetting";
import { Q } from "@nozbe/watermelondb";
import { WatermelonSupplierRepository } from "@infrastructure/watermelon/repositories/WatermelonSupplierRepository";
import { paymentVoucherRepository } from "@application/features/PaymentVoucher/repositories/paymentVoucherRepository";

export interface SupplierLedgerItem {
  id: string;
  type: "purchase_invoice" | "payment_voucher";
  date: Date;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface SupplierRepository {
  getById(id: string): Promise<SupplierData | null>;

  getAll(): Promise<SupplierData[]>;

  getActive(): Promise<SupplierData[]>;

  getByPhone(phone: string): Promise<SupplierData[]>;

  create(input: CreateSupplierInput): Promise<SupplierData>;

  update(id: string, input: UpdateSupplierInput): Promise<SupplierData>;

  deactivate(id: string): Promise<SupplierData>;

  activate(id: string): Promise<SupplierData>;
}

const supplierCore = new WatermelonSupplierRepository(database);
const suppliers = database.get<Supplier>(Supplier.table);
const purchases = database.get<PurchaseInvoice>(PurchaseInvoice.table);
const payments = database.get<PaymentVoucher>(PaymentVoucher.table);
const settings = database.get<AccountingSetting>(AccountingSetting.table);

export const getDetailedSupplierLedger = async (
  supplierId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<SupplierLedgerItem[]> => {
  const purchaseRows = await purchases
    .query(
      Q.where("supplier_id", supplierId),
      Q.where("is_cancelled", false),
      Q.where("status", Q.notEq("draft")),
    )
    .fetch();
  const paymentRows = await payments
    .query(
      Q.where("supplier_id", supplierId),
      Q.where("is_cancelled", false),
      Q.where("status", "posted"),
    )
    .fetch();
  const start = startDate?.getTime();
  const end = endDate?.getTime();
  const rows: Array<Omit<SupplierLedgerItem, "runningBalance">> = [];
  purchaseRows.forEach((row) => {
    if (
      (start !== undefined && row.invoiceDate < start) ||
      (end !== undefined && row.invoiceDate > end)
    )
      return;
    rows.push({
      id: row.id,
      type: "purchase_invoice",
      date: new Date(row.invoiceDate),
      description: `فاتورة شراء ${row.invoiceNumber ?? row.id}`,
      debit: 0,
      credit: row.total,
    });
  });
  paymentRows.forEach((row) => {
    if (
      (start !== undefined && row.voucherDate < start) ||
      (end !== undefined && row.voucherDate > end)
    )
      return;
    rows.push({
      id: row.id,
      type: "payment_voucher",
      date: new Date(row.voucherDate),
      description: `سند صرف ${row.voucherNumber}`,
      debit: row.amount,
      credit: 0,
    });
  });
  rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  let balance = 0;
  return rows.map((row) => {
    balance += row.credit - row.debit;
    return { ...row, runningBalance: balance };
  });
};

export const supplierRepository = {
  observeAll: () =>
    suppliers
      .query(Q.where("is_active", true), Q.sortBy("name", Q.asc))
      .observe(),
  getById: async (id: string) => suppliers.find(id).catch(() => null),
  getAll: () => suppliers.query(Q.sortBy("name", Q.asc)).fetch(),
  getActive: () =>
    suppliers
      .query(Q.where("is_active", true), Q.sortBy("name", Q.asc))
      .fetch(),
  getByPhone: (phone: string) =>
    suppliers.query(Q.where("phone", phone.trim())).fetch(),
  create: (input: CreateSupplierInput) => supplierCore.create(input),
  update: (id: string, input: UpdateSupplierInput) =>
    supplierCore.update(id, input),
  deactivate: (id: string) => supplierCore.deactivate(id),
  activate: (id: string) => supplierCore.activate(id),
  getOutstandingBalance: async (id: string) => {
    const rows = await getDetailedSupplierLedger(id);
    return rows.length ? rows[rows.length - 1].runningBalance : 0;
  },
  getDetailedLedger: getDetailedSupplierLedger,
  addSupplierPayment: async (
    supplierId: string,
    amount: number,
    description?: string,
  ) => {
    const setting = (await settings.query(Q.take(1)).fetch())[0];
    if (!setting?.cashDefaultAccountId)
      throw new Error("لم يتم إعداد حساب الصندوق الافتراضي.");
    return paymentVoucherRepository.createAndAllocateToSupplier({
      voucherNumber: `PV-${Date.now()}`,
      voucherDate: new Date(),
      paymentAccountId: setting.cashDefaultAccountId,
      supplierId,
      amount,
      description,
      createdBy: "current-user",
    });
  },
};
