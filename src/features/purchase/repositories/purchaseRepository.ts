/* eslint-disable complexity */
// core/repositories/purchaseRepository.ts
import { database } from "@core/database";
import PurchaseInvoice from "@core/database/models/PurchaseInvoice";
import PurchaseInvoiceItem from "@core/database/models/PurchaseInvoiceItem";
import Supplier from "@core/database/models/Supplier";
import Product from "@core/database/models/Product";
import ProductUnit from "@core/database/models/ProductUnit";
// import ProductBatch from "@core/database/models/ProductBatch"; // 👈 أضفنا استيراد موديل الدفعات
import { Model, Q } from "@nozbe/watermelondb";
import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";
import { PurchaseAccountingService } from "@core/services/PurchaseAccountingService"; // 👈 للقيود المحاسبية للمشتريات
import { generateNumber } from "@shared/utils/id";
import { paymentVoucherRepository } from "@features/PaymentVoucher/repositories/paymentVoucherRepository";
import JournalEntry from "@core/database/models/JournalEntry";
import PaymentAllocation from "@core/database/models/PaymentAllocation";
import { JournalService } from "@core/services/JournalService";
import PaymentVoucher from "@core/database/models/PaymentVoucher";
import { AccountingSettingsService } from "@core/services/AccountingSettingsService";
// ============================
// تعريف المجموعات (Collections)
// ============================
const purchaseInvoicesCollection =
  database.get<PurchaseInvoice>("purchase_invoices");
const purchaseInvoiceItemsCollection = database.get<PurchaseInvoiceItem>(
  "purchase_invoice_items",
);
const suppliersCollection = database.get<Supplier>("suppliers");
const productsCollection = database.get<Product>("products");
const productUnitsCollection = database.get<ProductUnit>("product_units");
// const productBatchesCollection = database.get<ProductBatch>("product_batches"); // 👈 معرفة المجموعة هنا لمنع خطأ الـ Runtime
const journalEntriesCollection = database.get<JournalEntry>("journal_entries");
const paymentVouchersCollection =
  database.get<PaymentVoucher>("payment_vouchers");

const paymentAllocationsCollection = database.get<PaymentAllocation>(
  "payment_allocations",
);
// ============================
// الأنواع (Types)
// ============================
export type PurchaseInvoiceStatus =
  | "draft"
  | "approved"
  | "cancelled"
  | "partial"
  | "paid";
export type PaymentType = "cash" | "credit" | "partial";

export interface CreatePurchaseInvoiceData {
  supplierId?: string;
  invoiceDate: Date;
  paymentType: PaymentType;
  paidAmount?: number; // 👈 المبلغ المدفوع مقدماً إن وجد
  items: {
    productId: string;
    productUnitId: string;
    quantity: number;
    unitCost: number;
  }[];
}

export interface UpdatePurchaseInvoiceData
  extends Partial<CreatePurchaseInvoiceData> {
  id: string;
}

// ============================
// الـ Repository
// ============================
export const purchaseRepository = {
  // ----------------------------------------------
  // 1. دوال المراقبة (Observables)
  // ----------------------------------------------

  observeAll: () =>
    purchaseInvoicesCollection
      .query(Q.sortBy("invoice_date", Q.desc))
      .observe(),

  observeByStatus: (status: PurchaseInvoiceStatus) =>
    purchaseInvoicesCollection
      .query(Q.where("status", status), Q.sortBy("invoice_date", Q.desc))
      .observe(),

  observeById: (id: string) => purchaseInvoicesCollection.findAndObserve(id),

  observeItems: (invoiceId: string) =>
    purchaseInvoiceItemsCollection
      .query(
        Q.where("purchase_invoice_id", invoiceId),
        Q.sortBy("created_at", Q.asc),
      )
      .observe(),

  // ----------------------------------------------
  // 2. دوال الكتابة (Write)
  // ----------------------------------------------

  createDraft: (data: CreatePurchaseInvoiceData) =>
    database.write(async () => {
      const total = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unitCost,
        0,
      );

      const paid = data.paidAmount ?? 0;
      // let initialStatus: PurchaseInvoiceStatus = "draft";

      // إذا كانت نقداً والمبلغ يغطي الإجمالي
      if (data.paymentType === "cash" && paid >= total) {
        // initialStatus = "approved"; // أو تحفظ كمسودة حسب رغبتك، الأفضل كمسودة ليراجعها المندوب ثم يعتمدها
      }

      const invoice = await purchaseInvoicesCollection.create((inv) => {
        inv.invoiceNumber = generateNumber("PUR"); // 👈 استخدام نظام العدادات المستقلة
        inv.invoiceDate = data.invoiceDate;
        inv.paymentType = data.paymentType;
        inv.status = "draft"; // نبقيها مسودة حتى يتم اعتمادها رسمياً
        inv.total = total;
        inv.paidAmount = paid;
        inv.createdBy = "user-id";
        inv.supplierId = data.supplierId ?? null;
      });

      await Promise.all(
        data.items.map((item) =>
          purchaseInvoiceItemsCollection.create((invItem) => {
            invItem.purchaseInvoiceId = invoice.id;
            invItem.productId = item.productId;
            invItem.productUnitId = item.productUnitId;
            invItem.quantity = item.quantity;
            invItem.unitCost = item.unitCost;
            invItem.total = item.quantity * item.unitCost;
          }),
        ),
      );

      return invoice;
    }),

  updateDraft: (data: UpdatePurchaseInvoiceData) =>
    database.write(async () => {
      const invoice = await purchaseInvoicesCollection.find(data.id);

      if (invoice.status !== "draft") {
        throw new Error("لا يمكن تعديل فاتورة غير مسودة");
      }

      await invoice.update((inv) => {
        if (data.supplierId !== undefined) {
          inv.supplierId = data.supplierId ?? null;
        }
        if (data.invoiceDate) {
          inv.invoiceDate = data.invoiceDate;
        }
        if (data.paymentType) {
          inv.paymentType = data.paymentType;
        }
        if (data.paidAmount !== undefined) {
          inv.paidAmount = data.paidAmount;
        }
      });

      if (data.items) {
        const oldItems = await purchaseInvoiceItemsCollection
          .query(Q.where("purchase_invoice_id", invoice.id))
          .fetch();
        await Promise.all(oldItems.map((item) => item.destroyPermanently()));

        const total = data.items.reduce(
          (sum, item) => sum + item.quantity * item.unitCost,
          0,
        );

        await Promise.all(
          data.items.map((item) =>
            purchaseInvoiceItemsCollection.create((invItem) => {
              invItem.purchaseInvoiceId = invoice.id;
              invItem.productId = item.productId;
              invItem.productUnitId = item.productUnitId;
              invItem.quantity = item.quantity;
              invItem.unitCost = item.unitCost;
              invItem.total = item.quantity * item.unitCost;
            }),
          ),
        );

        await invoice.update((inv) => {
          inv.total = total;
        });
      }

      return invoice;
    }),

  /**
   * ترحيل الفاتورة (اعتمادها)
   */
  approve: async (invoiceId: string) => {
    // Operations are prepared outside the transaction to avoid side-effects during preparation
    const invoice = await purchaseInvoicesCollection.find(invoiceId);

    if (invoice.status !== "draft") {
      throw new Error("لا يمكن ترحيل فاتورة غير مسودة");
    }

    const items = await invoice.items.fetch();

    if (items.length === 0) {
      throw new Error("لا يمكن ترحيل فاتورة بدون بنود");
    }

    const allOperations: Model[] = [];

    // 1. Prepare inventory operations
    for (const item of items) {
      const inventoryOps = await inventoryRepository.prepareHandlePurchase({
        productId: item.productId,
        productUnitId: item.productUnitId,
        purchaseItemId: item.id,
        quantity: item.quantity,
        unitCost: item.unitCost,
      });
      allOperations.push(...inventoryOps);
    }

    // 2. Prepare accounting entry
    const accountingOps = await PurchaseAccountingService.preparePurchaseEntry(
      invoice,
    );
    allOperations.push(...accountingOps);

    const paid = invoice.paidAmount ?? 0;

    const accountingSettings = await AccountingSettingsService.getSettings();

    if (!accountingSettings.cashAccountId) {
      throw new Error(
        "لم يتم تحديد حساب الصندوق الافتراضي في إعدادات المحاسبة.",
      );
    }

    const paymentOps =
      await paymentVoucherRepository.prepareCreateAndAllocateToSupplier({
        voucherNumber: generateNumber("PV"),
        voucherDate: invoice.invoiceDate,
        paymentAccountId: accountingSettings.cashAccountId,
        supplierId: invoice.supplierId,
        amount: paid,
        description: `سند صرف تلقائي لفاتورة شراء رقم ${invoice.invoiceNumber}`,
        createdBy: invoice.createdBy,
        purchaseInvoiceId: invoice.id,
        skipAccounting: true,
        invoicePaymentAlreadyRecorded: true,
      });

    allOperations.push(...paymentOps);

    // 4. Prepare final invoice status update
    // This is done last to correctly reflect the state after all operations are prepared.
    // It correctly uses the original `paid` amount from the draft invoice.
    const finalStatus =
      paid >= invoice.total && invoice.total > 0
        ? "paid"
        : paid > 0
        ? "partial"
        : "approved";
    allOperations.push(
      invoice.prepareUpdate((inv) => (inv.status = finalStatus)),
    );

    // Execute all prepared operations in a single atomic transaction
    await database.write(async () => {
      await database.batch(...allOperations);
    });

    return invoice;
  },
  cancel: async (invoiceId: string) => {
    // ============================================================
    // 1. جلب الفاتورة
    // ============================================================

    const invoice = await purchaseInvoicesCollection.find(invoiceId);

    // ============================================================
    // 2. إذا كانت مسودة
    // ============================================================

    if (invoice.status === "draft") {
      return database.write(async () => {
        const items = await purchaseInvoiceItemsCollection
          .query(Q.where("purchase_invoice_id", invoiceId))
          .fetch();

        await Promise.all(items.map((item) => item.destroyPermanently()));

        await invoice.destroyPermanently();

        return null;
      });
    }

    // ============================================================
    // 3. التحقق من حالة الفاتورة
    // ============================================================

    if (
      invoice.status !== "approved" &&
      invoice.status !== "partial" &&
      invoice.status !== "paid"
    ) {
      throw new Error("لا يمكن إلغاء الفاتورة في حالتها الحالية.");
    }

    // ============================================================
    // 4. جلب بنود الفاتورة
    // ============================================================

    const items = await purchaseInvoiceItemsCollection
      .query(Q.where("purchase_invoice_id", invoiceId))
      .fetch();

    if (items.length === 0) {
      throw new Error("لا توجد بنود مرتبطة بالفاتورة.");
    }

    // ============================================================
    // العمليات التي ستنفذ Atomic
    // ============================================================

    const allOperations: Model[] = [];

    // ============================================================
    // 5. عكس المخزون
    // ============================================================

    for (const item of items) {
      const inventoryOperations =
        await inventoryRepository.preparePurchaseCancellation(
          item.id,
          item.productId,
          item.quantity,
        );

      allOperations.push(...inventoryOperations);
    }

    // ============================================================
    // 6. عكس القيود المحاسبية الأصلية للفاتورة
    // ============================================================

    const purchaseJournalEntries = await journalEntriesCollection
      .query(
        Q.where("reference_type", "purchase_invoice"),
        Q.where("reference_id", invoice.id),
        Q.where("status", "posted"),
      )
      .fetch();

    for (const entry of purchaseJournalEntries) {
      const reversalOperations = await JournalService.prepareReverseEntry(
        entry,
        `عكس قيد إلغاء فاتورة شراء رقم ${invoice.invoiceNumber}`,
        invoice.createdBy,
      );

      allOperations.push(...reversalOperations);

      allOperations.push(
        entry.prepareUpdate((entryModel) => {
          entryModel.status = "cancelled";
        }),
      );
    }

    // ============================================================
    // 7. البحث عن تخصيصات الدفع الخاصة بالفاتورة
    // ============================================================

    const allocations = await paymentAllocationsCollection
      .query(
        Q.where("allocatable_type", "purchase_invoices"),
        Q.where("allocatable_id", invoice.id),
      )
      .fetch();

    // ============================================================
    // 8. حساب إجمالي المبالغ المدفوعة فعليًا عبر التخصيصات
    // ============================================================

    let totalAllocatedAmount = 0;

    for (const allocation of allocations) {
      totalAllocatedAmount += Math.max(Number(allocation.amount) || 0, 0);
    }

    // ============================================================
    // 9. معالجة سندات الصرف
    // ============================================================

    const processedVoucherIds = new Set<string>();

    for (const allocation of allocations) {
      const voucherId = allocation.paymentVoucherId;

      if (!voucherId) {
        continue;
      }

      if (processedVoucherIds.has(voucherId)) {
        continue;
      }

      processedVoucherIds.add(voucherId);

      const voucher = await paymentVouchersCollection.find(voucherId);

      // ==========================================================
      // 9.1 هل سند الصرف تلقائي خاص بهذه الفاتورة؟
      //
      // تم تعريفه في prepareCreateAndAllocateToSupplier
      // كالتالي:
      //
      // referenceType = "purchase_invoice"
      // referenceId   = invoice.id
      // ==========================================================

      const isAutomaticInvoiceVoucher =
        voucher.referenceType === "purchase_invoice" &&
        voucher.referenceId === invoice.id;

      if (isAutomaticInvoiceVoucher) {
        // --------------------------------------------------------
        // إلغاء سند الصرف
        // --------------------------------------------------------

        if (voucher.status === "posted") {
          allOperations.push(
            voucher.prepareUpdate((voucherModel) => {
              voucherModel.status = "cancelled";
            }),
          );
        }

        // --------------------------------------------------------
        // عكس القيد المحاسبي لسند الصرف
        // --------------------------------------------------------

        const paymentJournalEntries = await journalEntriesCollection
          .query(
            Q.where("reference_type", "payment_voucher"),
            Q.where("reference_id", voucher.id),
            Q.where("status", "posted"),
          )
          .fetch();

        for (const entry of paymentJournalEntries) {
          const reversalOperations = await JournalService.prepareReverseEntry(
            entry,
            `عكس سند صرف رقم ${voucher.voucherNumber} بسبب إلغاء فاتورة شراء رقم ${invoice.invoiceNumber}`,
            invoice.createdBy,
          );

          allOperations.push(...reversalOperations);

          allOperations.push(
            entry.prepareUpdate((entryModel) => {
              entryModel.status = "cancelled";
            }),
          );
        }
      } else {
        // ========================================================
        // سند صرف مستقل
        //
        // لا نلغيه بالكامل.
        //
        // لأنه قد يكون موزعًا على عدة فواتير.
        // ========================================================
        // لا نقوم بإلغاء الـ voucher هنا.
        //
        // فقط نترك التخصيص التاريخي مرتبطًا بالفاتورة الملغاة.
        //
        // الفاتورة ستصبح cancelled، وبالتالي لا تدخل في
        // الرصيد المستحق للمورد.
      }
    }

    // ============================================================
    // 10. إعادة paidAmount
    //
    // بما أن الفاتورة ستصبح cancelled، فإن المدفوعات المرتبطة
    // بها يجب ألا تبقى محسوبة ضمن رصيد الفاتورة.
    //
    // نحافظ على PaymentAllocation كسجل تاريخي.
    // ============================================================

    allOperations.push(
      invoice.prepareUpdate((invoiceModel) => {
        invoiceModel.paidAmount = Math.max(
          invoice.paidAmount - totalAllocatedAmount,
          0,
        );

        invoiceModel.status = "cancelled";
      }),
    );

    // ============================================================
    // 11. تنفيذ كل شيء Atomic
    // ============================================================

    await database.write(async () => {
      await database.batch(...allOperations);
    });

    return invoice;
  },

  deleteDraft: (invoiceId: string) =>
    database.write(async () => {
      const invoice = await purchaseInvoicesCollection.find(invoiceId);

      if (invoice.status !== "draft") {
        throw new Error("لا يمكن حذف فاتورة غير مسودة");
      }

      const items = await purchaseInvoiceItemsCollection
        .query(Q.where("purchase_invoice_id", invoiceId))
        .fetch();
      await Promise.all(items.map((item) => item.destroyPermanently()));

      await invoice.destroyPermanently();
    }),

  // ----------------------------------------------
  // 3. دوال مساعدة (لجلب البيانات)
  // ----------------------------------------------

  getInvoiceWithItems: async (invoiceId: string) => {
    const invoice = await purchaseInvoicesCollection.find(invoiceId);
    const items = await purchaseInvoiceItemsCollection
      .query(Q.where("purchase_invoice_id", invoiceId))
      .fetch();

    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        const product = await productsCollection.find(item.productId);
        const productUnit = await productUnitsCollection.find(
          item.productUnitId,
        );
        return { ...item, product, productUnit };
      }),
    );

    return { invoice, items: itemsWithDetails };
  },

  getSuppliers: () =>
    suppliersCollection.query(Q.sortBy("name", Q.asc)).fetch(),

  getProductsWithUnits: async () => {
    const products = await productsCollection
      .query(Q.where("is_active", true), Q.sortBy("name", Q.asc))
      .fetch();

    const result = await Promise.all(
      products.map(async (product) => {
        const units = await productUnitsCollection
          .query(Q.where("product_id", product.id))
          .fetch();
        return { ...product, units };
      }),
    );

    return result;
  },
};
