/* eslint-disable no-restricted-syntax */
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

// ============================================================
// Collections
// ============================================================

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

// ============================================================
// سند القبض التلقائي
// ============================================================

/**
 * إنشاء سند قبض تلقائي للجزء المدفوع من فاتورة البيع.
 *
 * يستخدم فقط عندما تكون الفاتورة مرتبطة بعميل.
 *
 * المعالجة المحاسبية:
 *
 *   من حـ/ الصندوق
 *       إلى حـ/ العملاء
 *
 * وذلك لأن قيد البيع الأصلي سجل كامل قيمة الفاتورة
 * على حساب العملاء.
 */
const prepareAutomaticReceipt = async (
  invoice: SalesInvoice,
  amount: number,
): Promise<Model[]> => {
  if (amount <= 0) {
    return [];
  }

  if (!invoice.customerId) {
    throw new Error("لا يمكن إنشاء سند قبض تلقائي بدون تحديد العميل.");
  }

  const settings = await AccountingSettingsService.getSettings();

  if (!settings.cashAccountId) {
    throw new Error("لم يتم تحديد حساب الصندوق الافتراضي في إعدادات المحاسبة.");
  }

  if (amount > invoice.total) {
    throw new Error("مبلغ سند القبض لا يمكن أن يتجاوز إجمالي الفاتورة.");
  }

  const operations: Model[] = [];

  // ==========================================================
  // 1. إنشاء سند القبض
  // ==========================================================

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

  // ==========================================================
  // 2. تخصيص سند القبض على الفاتورة
  // ==========================================================

  const allocation = paymentAllocationsCollection.prepareCreate((pa) => {
    pa.receiptVoucherId = receipt.id;

    pa.allocatableType = "sales_invoices";

    pa.allocatableId = invoice.id;

    pa.amount = amount;
  });

  operations.push(allocation);

  // ==========================================================
  // 3. القيد المحاسبي لسند القبض
  //
  // من حـ/ الصندوق
  //     إلى حـ/ العملاء
  // ==========================================================

  const journalOperations = await ReceiptAccountingService.prepareReceiptEntry(
    receipt,
    [allocation],
  );

  operations.push(...journalOperations);

  return operations;
};

// ============================================================
// Repository
// ============================================================

export const salesRepository = {
  // ==========================================================
  // Observables
  // ==========================================================

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

  // ==========================================================
  // إنشاء مسودة
  // ==========================================================

  create: async (data: SalesInvoiceFormData) => {
    const operations: Model[] = [];

    // ========================================================
    // العميل
    // ========================================================

    const customer = data.customerId
      ? await customersCollection.find(data.customerId)
      : null;

    // ========================================================
    // حساب الإجمالي
    // ========================================================

    const subtotal = data.items.reduce(
      (sum, item) =>
        sum + item.unitPrice * item.quantity - (item.discount || 0),
      0,
    );

    const total = subtotal - (data.discountTotal || 0);

    if (total < 0) {
      throw new Error("إجمالي الفاتورة لا يمكن أن يكون سالباً.");
    }

    // ========================================================
    // المبلغ المدفوع
    // ========================================================

    const paidAmount = data.paidAmount ?? 0;

    if (paidAmount < 0) {
      throw new Error("المبلغ المدفوع لا يمكن أن يكون سالباً.");
    }

    if (paidAmount > total) {
      throw new Error("المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الفاتورة.");
    }

    // ========================================================
    // التحقق من نوع الدفع
    // ========================================================

    if (data.paymentType === "credit" && paidAmount > 0) {
      throw new Error("الفاتورة الآجلة لا يمكن أن تحتوي على مبلغ مدفوع.");
    }

    if (data.paymentType === "cash" && total > 0 && paidAmount !== total) {
      throw new Error(
        "الفاتورة النقدية يجب أن يكون المبلغ المدفوع فيها مساوياً لإجمالي الفاتورة.",
      );
    }

    if (data.paymentType === "partial" && paidAmount <= 0) {
      throw new Error("الفاتورة الجزئية يجب أن تحتوي على مبلغ مدفوع.");
    }

    // ========================================================
    // إنشاء الفاتورة
    // ========================================================

    const preparedInvoice = salesInvoicesCollection.prepareCreate((inv) => {
      if (customer) {
        inv.customer.set(customer);
      }

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

    // ========================================================
    // إنشاء البنود
    // ========================================================

    for (const itemData of data.items) {
      const product = itemData.productId
        ? await productsCollection.find(itemData.productId)
        : null;

      const productUnit = itemData.productUnitId
        ? await productUnitsCollection.find(itemData.productUnitId)
        : null;

      const itemTotal =
        itemData.unitPrice * itemData.quantity - (itemData.discount || 0);

      if (itemTotal < 0) {
        throw new Error("إجمالي أحد بنود الفاتورة لا يمكن أن يكون سالباً.");
      }

      const preparedItem = salesInvoiceItemsCollection.prepareCreate((item) => {
        item.salesInvoice.set(preparedInvoice);

        item.itemType = itemData.itemType || "product";

        if (product) {
          item.product.set(product);
        }

        if (productUnit) {
          item.productUnit.set(productUnit);
        }

        item.quantity = itemData.quantity;

        item.unitPrice = itemData.unitPrice;

        item.total = itemTotal;

        item.costAtSale = 0;

        item.description = itemData.description || null;
      });

      operations.push(preparedItem);
    }

    // ========================================================
    // حفظ المسودة
    // ========================================================

    await database.write(async () => {
      await database.batch(...operations);
    });

    // ========================================================
    // الاعتماد مباشرة إذا طلب النموذج ذلك
    // ========================================================

    if (data.status === "approved") {
      return salesRepository.approve(preparedInvoice.id);
    }

    return preparedInvoice;
  },

  // ==========================================================
  // اعتماد الفاتورة
  // ==========================================================

  approve: async (invoiceId: string) => {
    const invoice = await salesInvoicesCollection.find(invoiceId);

    if (invoice.status !== "draft") {
      throw new Error("لا يمكن اعتماد فاتورة غير مسودة.");
    }

    const items = await salesInvoiceItemsCollection
      .query(Q.where("sales_invoice_id", invoiceId))
      .fetch();

    if (items.length === 0) {
      throw new Error("لا يمكن اعتماد فاتورة بدون بنود.");
    }

    const operations: Model[] = [];

    // ========================================================
    // التحقق المحاسبي للدفع
    // ========================================================

    const paid = invoice.paidAmount ?? 0;

    if (paid < 0) {
      throw new Error("المبلغ المدفوع غير صحيح.");
    }

    if (paid > invoice.total) {
      throw new Error("المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الفاتورة.");
    }

    // ========================================================
    // التحقق من العميل
    // ========================================================

    const requiresCustomer =
      invoice.paymentType === "credit" || invoice.paymentType === "partial";

    if (requiresCustomer && !invoice.customerId) {
      throw new Error("يجب تحديد العميل للفواتير الآجلة أو الجزئية.");
    }

    /*
     * البيع النقدي بدون عميل:
     *
     * مسموح فقط عندما تكون الفاتورة مسددة بالكامل.
     *
     * في هذه الحالة SalesAccountingService
     * يسجل:
     *
     * من حـ/ الصندوق
     *     إلى حـ/ المبيعات
     *
     * ولا ننشئ سند قبض إضافي.
     */

    if (
      invoice.paymentType === "cash" &&
      invoice.total > 0 &&
      paid !== invoice.total
    ) {
      throw new Error("الفاتورة النقدية يجب أن تكون مسددة بالكامل.");
    }

    // ========================================================
    // 1. معالجة المخزون وحساب تكلفة المبيعات
    // ========================================================

    for (const item of items) {
      if (item.itemType !== "product" || !item.productId) {
        continue;
      }

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

    // ========================================================
    // 2. القيد المحاسبي للمبيعات
    // ========================================================

    const journalOperations = await SalesAccountingService.prepareSalesEntry(
      invoice,
      items,
    );

    operations.push(...journalOperations);

    // ========================================================
    // 3. تحديد حالة الفاتورة
    // ========================================================

    let finalStatus: SalesInvoiceStatus;

    if (invoice.total > 0 && paid >= invoice.total) {
      finalStatus = "paid";
    } else if (paid > 0) {
      finalStatus = "partial";
    } else {
      finalStatus = "approved";
    }

    // ========================================================
    // 4. سند القبض التلقائي
    // ========================================================

    /*
     * مهم:
     *
     * إذا لم يوجد عميل، فإن SalesAccountingService
     * يكون قد سجل المبلغ مباشرة في الصندوق.
     *
     * لذلك لا ننشئ ReceiptVoucher.
     *
     * أما إذا وجد عميل:
     *
     * قيد البيع:
     * العملاء ← كامل الفاتورة
     *
     * سند القبض:
     * الصندوق ← المبلغ المدفوع
     *
     * وهذا يمنع التكرار المحاسبي.
     */

    const shouldCreateAutomaticReceipt =
      invoice.customerId && paid > 0 && invoice.paymentType !== "credit";

    if (shouldCreateAutomaticReceipt) {
      const receiptOperations = await prepareAutomaticReceipt(invoice, paid);

      operations.push(...receiptOperations);
    }

    // ========================================================
    // 5. تحديث حالة الفاتورة
    // ========================================================

    operations.push(
      invoice.prepareUpdate((inv) => {
        inv.status = finalStatus;
      }),
    );

    // ========================================================
    // 6. تنفيذ Atomic Transaction
    // ========================================================

    await database.write(async () => {
      await database.batch(...operations);
    });

    return invoice;
  },

  // ==========================================================
  // إلغاء الفاتورة
  // ==========================================================

  cancel: async (invoiceId: string) => {
    const invoice = await salesInvoicesCollection.find(invoiceId);

    // ========================================================
    // مسودة
    // ========================================================

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

    // ========================================================
    // التحقق من الحالة
    // ========================================================

    if (!["approved", "partial", "paid"].includes(invoice.status)) {
      throw new Error("لا يمكن إلغاء الفاتورة في حالتها الحالية.");
    }

    const items = await salesInvoiceItemsCollection
      .query(Q.where("sales_invoice_id", invoiceId))
      .fetch();

    if (items.length === 0) {
      throw new Error("لا توجد بنود مرتبطة بالفاتورة.");
    }

    const operations: Model[] = [];

    // ========================================================
    // 1. عكس المخزون
    // ========================================================

    for (const item of items) {
      if (item.itemType !== "product" || !item.productId) {
        continue;
      }

      const returnOperations =
        await inventoryRepository.prepareHandleSaleReturn(
          item.productId,
          item.id,
          item.quantity,
        );

      operations.push(...returnOperations);
    }

    // ========================================================
    // 2. عكس قيود المبيعات
    // ========================================================

    const salesEntries = await journalEntriesCollection
      .query(
        Q.where("reference_type", "sales_invoice"),
        Q.where("reference_id", invoice.id),
        Q.where("status", "posted"),
      )
      .fetch();

    for (const entry of salesEntries) {
      const reversalOperations = await JournalService.prepareReverseEntry(
        entry,
        `عكس قيد إلغاء فاتورة بيع رقم ${invoice.invoiceNumber}`,
        invoice.createdBy,
      );

      operations.push(...reversalOperations);

      operations.push(
        entry.prepareUpdate((e) => {
          e.status = "cancelled";
        }),
      );
    }

    // ========================================================
    // 3. البحث عن سندات القبض المرتبطة
    // ========================================================

    const allocations = await paymentAllocationsCollection
      .query(
        Q.where("allocatable_type", "sales_invoice"),
        Q.where("allocatable_id", invoice.id),
      )
      .fetch();

    const processedVoucherIds = new Set<string>();

    for (const allocation of allocations) {
      if (!allocation.receiptVoucherId) {
        continue;
      }

      if (processedVoucherIds.has(allocation.receiptVoucherId)) {
        continue;
      }

      processedVoucherIds.add(allocation.receiptVoucherId);

      const voucher = await receiptVouchersCollection.find(
        allocation.receiptVoucherId,
      );

      // ======================================================
      // إلغاء سند القبض
      // ======================================================

      if (voucher.status !== "cancelled") {
        operations.push(
          voucher.prepareUpdate((v) => {
            v.status = "cancelled";
          }),
        );
      }

      // ======================================================
      // عكس قيد سند القبض
      // ======================================================

      const receiptEntries = await journalEntriesCollection
        .query(
          Q.where("reference_type", "receipt_voucher"),
          Q.where("reference_id", voucher.id),
          Q.where("status", "posted"),
        )
        .fetch();

      for (const entry of receiptEntries) {
        const reversalOperations = await JournalService.prepareReverseEntry(
          entry,
          `عكس سند قبض رقم ${voucher.voucherNumber} بسبب إلغاء فاتورة بيع رقم ${invoice.invoiceNumber}`,
          invoice.createdBy,
        );

        operations.push(...reversalOperations);

        operations.push(
          entry.prepareUpdate((e) => {
            e.status = "cancelled";
          }),
        );
      }
    }

    // ========================================================
    // 4. إلغاء الفاتورة
    // ========================================================

    operations.push(
      invoice.prepareUpdate((inv) => {
        inv.status = "cancelled";
      }),
    );

    // ========================================================
    // 5. Atomic Transaction
    // ========================================================

    await database.write(async () => {
      await database.batch(...operations);
    });

    return invoice;
  },

  // ==========================================================
  // حذف مسودة
  // ==========================================================

  deleteDraft: async (invoiceId: string) =>
    database.write(async () => {
      const invoice = await salesInvoicesCollection.find(invoiceId);

      if (invoice.status !== "draft") {
        throw new Error("لا يمكن حذف فاتورة غير مسودة.");
      }

      const items = await salesInvoiceItemsCollection
        .query(Q.where("sales_invoice_id", invoiceId))
        .fetch();

      await database.batch(
        ...items.map((item) => item.prepareDestroyPermanently()),
        invoice.prepareDestroyPermanently(),
      );
    }),

  // ==========================================================
  // قراءة فاتورة مع البنود
  // ==========================================================

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

        return {
          ...item,
          product,
          productUnit,
        };
      }),
    );

    return {
      invoice,
      items: itemsWithDetails,
    };
  },

  // ==========================================================
  // العملاء
  // ==========================================================

  getCustomers: () =>
    customersCollection.query(Q.sortBy("name", Q.asc)).fetch(),

  // ==========================================================
  // المنتجات والوحدات
  // ==========================================================

  getProductsWithUnits: async () => {
    const products = await productsCollection
      .query(Q.where("is_active", true), Q.sortBy("name", Q.asc))
      .fetch();

    return Promise.all(
      products.map(async (product) => {
        const units = await productUnitsCollection
          .query(Q.where("product_id", product.id))
          .fetch();

        return {
          ...product,
          units,
        };
      }),
    );
  },
};
