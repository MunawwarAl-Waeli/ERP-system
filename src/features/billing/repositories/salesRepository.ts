/* eslint-disable complexity */

import { database } from "@core/database";

import SalesInvoice from "@core/database/models/SalesInvoice";
import SalesInvoiceItem from "@core/database/models/SalesInvoiceItem";
import Customer from "@core/database/models/Customer";
import Product from "@core/database/models/Product";
import ProductUnit from "@core/database/models/ProductUnit";
import ReceiptVoucher from "@core/database/models/ReceiptVoucher";
import PaymentAllocation from "@core/database/models/PaymentAllocation";
import JournalEntry from "@core/database/models/JournalEntry";

import { Q, Model } from "@nozbe/watermelondb";

import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";

import { generateNumber } from "@shared/utils/id";

import {
  SalesInvoiceFormData,
  SalesInvoiceStatus,
} from "../schemas/salesInvoiceSchema";

import { AccountingSettingsService } from "@core/services/AccountingSettingsService";
import { SalesAccountingService } from "@core/services/SalesAccountingService";
import { ReceiptAccountingService } from "@core/services/ReceiptAccountingService";
import { JournalService } from "@core/services/JournalService";

const salesInvoicesCollection = database.get<SalesInvoice>("sales_invoices");
const salesInvoiceItemsCollection = database.get<SalesInvoiceItem>(
  "sales_invoice_items",
);
const customersCollection = database.get<Customer>("customers");
const productsCollection = database.get<Product>("products");
const productUnitsCollection = database.get<ProductUnit>("product_units");
const receiptVouchersCollection =
  database.get<ReceiptVoucher>("receipt_vouchers");
const paymentAllocationsCollection = database.get<PaymentAllocation>(
  "payment_allocations",
);
const journalEntriesCollection = database.get<JournalEntry>("journal_entries");

const prepareAutomaticReceipt = async (
  invoice: SalesInvoice,
  amount: number,
): Promise<Model[]> => {
  if (amount <= 0) return [];
  if (!invoice.customerId)
    throw new Error("لا يمكن إنشاء سند قبض تلقائي بدون تحديد العميل.");

  const settings = await AccountingSettingsService.getSettings();
  if (!settings.cashAccountId)
    throw new Error("لم يتم تحديد حساب الصندوق الافتراضي.");

  if (amount > invoice.total)
    throw new Error("مبلغ سند القبض لا يمكن أن يتجاوز إجمالي الفاتورة.");

  const operations: Model[] = [];

  const receipt = receiptVouchersCollection.prepareCreate((rv) => {
    rv.voucherNumber = generateNumber("RE");
    rv.voucherDate = invoice.invoiceDate;
    rv.paymentAccountId = settings.cashAccountId;
    rv.amount = amount;
    rv.description = `تحصيل نقدي للفاتورة رقم ${invoice.invoiceNumber}`;
    rv.referenceType = "sales_invoices";
    rv.referenceId = invoice.id;
    rv.createdBy = invoice.createdBy;
    rv.status = "posted";
  });
  operations.push(receipt);

  const allocation = paymentAllocationsCollection.prepareCreate((pa) => {
    pa.receiptVoucherId = receipt.id;
    pa.allocatableType = "sales_invoices";
    pa.allocatableId = invoice.id;
    pa.amount = amount;
  });
  operations.push(allocation);

  const journalOperations = await ReceiptAccountingService.prepareReceiptEntry(
    receipt,
    [allocation],
  );
  operations.push(...journalOperations);

  return operations;
};

export const salesRepository = {
  observeAll: () =>
    salesInvoicesCollection.query(Q.sortBy("invoice_date", Q.desc)).observe(),

  observeByStatus: (status: SalesInvoiceStatus) =>
    salesInvoicesCollection
      .query(Q.where("status", status), Q.sortBy("invoice_date", Q.desc))
      .observe(),

  observeById: (id: string) => salesInvoicesCollection.findAndObserve(id),

  observeItems: (invoiceId: string) =>
    salesInvoiceItemsCollection
      .query(Q.where("sales_invoice_id", invoiceId))
      .observe(),

  searchByInvoiceNumber: async (queryText: string) => {
    if (!queryText || queryText.trim() === "") {
      return salesInvoicesCollection
        .query(Q.sortBy("invoice_date", Q.desc))
        .fetch();
    }
    const cleaned = queryText.trim().toLowerCase();
    return salesInvoicesCollection
      .query(
        Q.or(
          Q.where("invoice_number", Q.like(`%${Q.sanitizeLike(cleaned)}%`)),
          Q.where("notes", Q.like(`%${Q.sanitizeLike(cleaned)}%`)),
        ),
        Q.sortBy("invoice_date", Q.desc),
      )
      .fetch();
  },

  getPopularProductIds: async (limit: number = 5): Promise<string[]> => {
    const items = await salesInvoiceItemsCollection.query().fetch();
    const countMap: { [productId: string]: number } = {};
    for (const item of items) {
      if (item.productId) {
        countMap[item.productId] =
          (countMap[item.productId] || 0) + item.quantity;
      }
    }
    return Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId]) => productId);
  },

  create: async (data: SalesInvoiceFormData & { serviceFee?: number }) => {
    const operations: Model[] = [];
    const customer = data.customerId
      ? await customersCollection.find(data.customerId)
      : null;

    const subtotal = data.items.reduce(
      (sum, item) =>
        sum + item.unitPrice * item.quantity - (item.discount || 0),
      0,
    );

    const serviceFee = data.serviceFee || 0;
    const total = Math.max(
      0,
      subtotal - (data.discountTotal || 0) + serviceFee,
    );

    if (total < 0) throw new Error("إجمالي الفاتورة لا يمكن أن يكون سالباً.");

    const paidAmount = data.paidAmount ?? 0;
    if (paidAmount < 0)
      throw new Error("المبلغ المدفوع لا يمكن أن يكون سالباً.");
    if (paidAmount > total)
      throw new Error("المبلغ المدفوع لا يمكن أن يتجاوز الإجمالي.");

    if (data.paymentType === "credit" && paidAmount > 0) {
      throw new Error("الفاتورة الآجلة لا يمكن أن تحتوي على مبلغ مدفوع.");
    }
    if (data.paymentType === "cash" && total > 0 && paidAmount !== total) {
      throw new Error("الفاتورة النقدية يجب أن تكون مسددة بالكامل.");
    }
    if (data.paymentType === "partial" && paidAmount <= 0) {
      throw new Error("الفاتورة الجزئية يجب أن تحتوي على مبلغ مدفوع.");
    }

    const preparedInvoice = salesInvoicesCollection.prepareCreate((inv) => {
      if (customer) inv.customer.set(customer);
      inv.invoiceNumber = generateNumber("SALE");
      inv.invoiceType = "sale";
      inv.invoiceDate = data.invoiceDate;
      inv.paymentType = data.paymentType;
      inv.status = "draft";
      inv.total = total;
      inv.paidAmount = paidAmount;
      inv.createdBy = "user-id";
    });
    operations.push(preparedInvoice);

    for (const itemData of data.items) {
      const product = itemData.productId
        ? await productsCollection.find(itemData.productId)
        : null;
      const productUnit = itemData.productUnitId
        ? await productUnitsCollection.find(itemData.productUnitId)
        : null;

      const itemTotal =
        itemData.unitPrice * itemData.quantity - (itemData.discount || 0);

      const preparedItem = salesInvoiceItemsCollection.prepareCreate((item) => {
        item.salesInvoice.set(preparedInvoice);
        item.itemType = itemData.itemType || "product";
        if (product) item.product.set(product);
        if (productUnit) item.productUnit.set(productUnit);
        item.quantity = itemData.quantity;
        item.unitPrice = itemData.unitPrice;
        item.total = itemTotal;
        item.costAtSale = 0;
        item.description = itemData.description || null;
      });
      operations.push(preparedItem);
    }

    await database.write(async () => {
      await database.batch(...operations);
    });

    if (data.status === "approved") {
      return salesRepository.approve(preparedInvoice.id);
    }
    return preparedInvoice;
  },

  approve: async (invoiceId: string) => {
    const invoice = await salesInvoicesCollection.find(invoiceId);
    if (invoice.status !== "draft")
      throw new Error("لا يمكن اعتماد فاتورة غير مسودة.");

    const items = await salesInvoiceItemsCollection
      .query(Q.where("sales_invoice_id", invoiceId))
      .fetch();
    if (items.length === 0) throw new Error("لا يمكن اعتماد فاتورة بدون بنود.");

    const operations: Model[] = [];
    const paid = invoice.paidAmount ?? 0;

    const requiresCustomer =
      invoice.paymentType === "credit" || invoice.paymentType === "partial";
    if (requiresCustomer && !invoice.customerId) {
      throw new Error("يجب تحديد العميل للفواتير الآجلة أو الجزئية.");
    }

    for (const item of items) {
      if (item.itemType !== "product" || !item.productId) continue;
      const result = await inventoryRepository.prepareHandleSale({
        productId: item.productId,
        saleItemId: item.id,
        quantity: item.quantity,
      });
      operations.push(...result.inventoryOperations);
      operations.push(
        item.prepareUpdate((i) => {
          i.costAtSale = result.totalCost;
        }),
      );
    }

    const journalOperations = await SalesAccountingService.prepareSalesEntry(
      invoice,
      items,
    );
    operations.push(...journalOperations);

    let finalStatus: SalesInvoiceStatus;
    if (invoice.total > 0 && paid >= invoice.total) {
      finalStatus = "paid";
    } else if (paid > 0) {
      finalStatus = "partial";
    } else {
      finalStatus = "approved";
    }

    const shouldCreateAutomaticReceipt =
      invoice.customerId && paid > 0 && invoice.paymentType !== "credit";
    if (shouldCreateAutomaticReceipt) {
      const receiptOperations = await prepareAutomaticReceipt(invoice, paid);
      operations.push(...receiptOperations);
    }

    operations.push(
      invoice.prepareUpdate((inv) => {
        inv.status = finalStatus;
      }),
    );

    await database.write(async () => {
      await database.batch(...operations);
    });

    return invoice;
  },

  cancel: async (invoiceId: string) => {
    const invoice = await salesInvoicesCollection.find(invoiceId);
    if (invoice.status === "draft") {
      const items = await salesInvoiceItemsCollection
        .query(Q.where("sales_invoice_id", invoiceId))
        .fetch();
      const operations: Model[] = [
        ...items.map((item) => item.prepareDestroyPermanently()),
        invoice.prepareDestroyPermanently(),
      ];
      await database.write(async () => {
        await database.batch(...operations);
      });
      return null;
    }

    const items = await salesInvoiceItemsCollection
      .query(Q.where("sales_invoice_id", invoiceId))
      .fetch();
    const operations: Model[] = [];

    for (const item of items) {
      if (item.itemType !== "product" || !item.productId) continue;
      const returnOperations =
        await inventoryRepository.prepareHandleSaleReturn(
          item.productId,
          item.id,
          item.quantity,
        );
      operations.push(...returnOperations);
    }

    operations.push(
      invoice.prepareUpdate((inv) => {
        inv.status = "cancelled";
      }),
    );

    await database.write(async () => {
      await database.batch(...operations);
    });

    return invoice;
  },

  getInvoiceWithItems: async (invoiceId: string) => {
    const invoice = await salesInvoicesCollection.find(invoiceId);
    const items = await salesInvoiceItemsCollection
      .query(Q.where("sales_invoice_id", invoiceId))
      .fetch();

    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        const product = item.productId
          ? await productsCollection.find(item.productId)
          : null;
        const productUnit = item.productUnitId
          ? await productUnitsCollection.find(item.productUnitId)
          : null;
        return { ...item, product, productUnit };
      }),
    );

    return { invoice, items: itemsWithDetails };
  },
};
