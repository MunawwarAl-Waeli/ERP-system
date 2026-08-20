/* eslint-disable require-await */
/* eslint-disable arrow-body-style */
import { database, PaymentAllocation, ReceiptVoucher, SalesInvoice } from "@core/database";
import Customer from "@core/database/models/Customer";
import { Q } from "@nozbe/watermelondb";
import { CustomerFormData } from "../schemas/customerSchema";
import { generateNumber } from "@shared/utils/id";
import { receiptVoucherRepository } from "@features/ReceiptVoucher/repositories/receiptVoucherRepository";

const customersCollection = database.get<Customer>("customers");
const salesInvoicesCollection = database.get<SalesInvoice>("sales_invoices");
const paymentAllocationsCollection = database.get<PaymentAllocation>("payment_allocations");
const receiptVouchersCollection = database.get<ReceiptVoucher>("receipt_vouchers");

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

  // --- الدوال المالية ---

  getOutstandingBalance: async (customerId: string): Promise<number> => {
    // 1. الفواتير غير الملغاة
    const invoices = await salesInvoicesCollection
      .query(
        Q.where("customer_id", customerId),
        Q.where("status", Q.notEq("cancelled")), // ✅ التصحيح
      )
      .fetch();

    let totalInvoices = 0;
    let totalPaid = 0;

    for (const invoice of invoices) {
      totalInvoices += invoice.total || 0;

      const allocations = await paymentAllocationsCollection
        .query(
          Q.where("allocatable_type", "sales_invoice"), // ✅ موحد
          Q.where("allocatable_id", invoice.id),
        )
        .fetch();
      totalPaid += allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    }

    return totalInvoices - totalPaid;
  },

  getInvoicesWithBalance: async (customerId: string) => {
    const invoices = await salesInvoicesCollection
      .query(
        Q.where("customer_id", customerId),
        Q.where("status", Q.notEq("cancelled")),
        Q.sortBy("invoice_date", Q.desc),
      )
      .fetch();

    const result = [];
    for (const invoice of invoices) {
      const allocations = await paymentAllocationsCollection
        .query(
          Q.where("allocatable_type", "sales_invoice"),
          Q.where("allocatable_id", invoice.id),
        )
        .fetch();
      const paid = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      result.push({
        ...invoice,
        paid,
        remaining: invoice.total - paid,
      });
    }
    return result;
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
      paymentAccountId: "jgjh",
      customerId,
      amount,
      description: notes || "دفعه من عميل ",
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
