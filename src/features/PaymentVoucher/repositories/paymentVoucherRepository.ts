import { database } from "@core/database";
import PaymentVoucher from "@core/database/models/PaymentVoucher";
import PurchaseInvoice from "@core/database/models/PurchaseInvoice";
import PaymentAllocation from "@core/database/models/PaymentAllocation";
import { Q, Model } from "@nozbe/watermelondb";
import { PaymentAccountingService } from "@core/services/PaymentAccountingService";

interface CreateAndAllocateSupplierData {
  voucherNumber: string;
  voucherDate: Date;
  paymentAccountId: string;
  supplierId: string;
  amount: number;
  description?: string;
  createdBy: string;

  /**
   * منع إنشاء قيد محاسبي من سند الصرف.
   * يستخدم عند إنشاء سند صرف تلقائي ضمن عملية شراء
   * لأن PurchaseAccountingService يكون قد سجل الأثر المحاسبي مسبقاً.
   */
  skipAccounting?: boolean;

  /**
   * معرف فاتورة شراء محددة يتم تخصيص السند لها مباشرة.
   *
   * يستخدم مع سند الصرف التلقائي الناتج عن اعتماد فاتورة شراء.
   * يتجاوز FIFO ويضمن الوصول إلى الفاتورة الحالية حتى لو كانت
   * في حالة draft أثناء مرحلة التحضير.
   */
  purchaseInvoiceId?: string;

  /**
   * يخبر المستودع بأن paidAmount للفاتورة تم تسجيله مسبقاً
   * ولا يجب زيادته مرة أخرى.
   *
   * يستخدم لمنع double counting عندما تكون قيمة المدفوع
   * قد دخلت بالفعل ضمن الفاتورة قبل إنشاء سند الصرف التلقائي.
   */
  invoicePaymentAlreadyRecorded?: boolean;
}

const paymentVouchersCollection =
  database.get<PaymentVoucher>("payment_vouchers");

const purchaseInvoicesCollection =
  database.get<PurchaseInvoice>("purchase_invoices");

const paymentAllocationsCollection = database.get<PaymentAllocation>(
  "payment_allocations",
);

export const paymentVoucherRepository = {
  /**
   * تحضير إنشاء سند صرف وتخصيصه على حساب المورد.
   *
   * هذه الدالة لا تقوم بالكتابة المباشرة إلى قاعدة البيانات.
   * جميع العمليات يتم تحضيرها وإرجاعها حتى يستطيع المستدعي
   * دمجها داخل database.batch() واحد Atomic.
   */
  prepareCreateAndAllocateToSupplier: async (
    data: CreateAndAllocateSupplierData,
  ): Promise<Model[]> => {
    const allOperations: Model[] = [];
    const preparedAllocations: PaymentAllocation[] = [];

    // ============================================================
    // 1. تحضير سند الصرف
    // ============================================================

    const voucher = paymentVouchersCollection.prepareCreate((v) => {
      v.voucherNumber = data.voucherNumber;
      v.voucherDate = data.voucherDate;
      v.paymentAccountId = data.paymentAccountId;
      v.amount = data.amount;
      v.description = data.description ?? "سند صرف - سداد حساب المورد";
      v.referenceType = "suppliers";
      v.referenceId = data.supplierId;
      v.status = "posted";
      v.createdBy = data.createdBy;
    });

    allOperations.push(voucher);

    let remainingPayment = data.amount;

    // ============================================================
    // 2. المسار المباشر: تخصيص السند على فاتورة محددة
    // ============================================================

    if (data.purchaseInvoiceId) {
      const invoice = await purchaseInvoicesCollection.find(
        data.purchaseInvoiceId,
      );

      // ----------------------------------------------------------
      // التحقق من أن الفاتورة تخص المورد المحدد
      // ----------------------------------------------------------

      if (invoice.supplierId !== data.supplierId) {
        throw new Error("Invoice does not belong to the specified supplier.");
      }

      // ----------------------------------------------------------
      // حساب المبلغ غير المسدد
      // ----------------------------------------------------------

      const unpaidOnInvoice = Math.max(invoice.total - invoice.paidAmount, 0);

      const allocationForThisInvoice = Math.min(
        remainingPayment,
        unpaidOnInvoice,
      );

      // ----------------------------------------------------------
      // إنشاء PaymentAllocation
      // ----------------------------------------------------------

      if (allocationForThisInvoice > 0) {
        const allocation = paymentAllocationsCollection.prepareCreate((p) => {
          p.paymentVoucherId = voucher.id;
          p.allocatableType = "purchase_invoices";
          p.allocatableId = invoice.id;
          p.amount = allocationForThisInvoice;
        });

        preparedAllocations.push(allocation);
        allOperations.push(allocation);

        // --------------------------------------------------------
        // تحديث paidAmount فقط إذا لم يكن مسجلاً مسبقاً
        // --------------------------------------------------------

        if (!data.invoicePaymentAlreadyRecorded) {
          const newPaidAmount = invoice.paidAmount + allocationForThisInvoice;

          const newStatus = newPaidAmount >= invoice.total ? "paid" : "partial";

          const invoiceUpdate = invoice.prepareUpdate((inv) => {
            inv.paidAmount = newPaidAmount;
            inv.status = newStatus;
          });

          allOperations.push(invoiceUpdate);
        }

        remainingPayment -= allocationForThisInvoice;
      }
    } else {
      // ============================================================
      // 3. المسار المستقل: FIFO
      // ============================================================
      //
      // يستخدم عندما ينشئ المستخدم سند صرف مستقل للمورد
      // بدون purchaseInvoiceId.
      //
      // في هذه الحالة:
      // - نبحث عن الفواتير approved / partial
      // - نرتبها من الأقدم إلى الأحدث
      // - نوزع المبلغ عليها
      // - نحدث paidAmount
      // - نحدث status
      //
      // وهذا هو المسار الذي يحتاج إلى إنشاء القيد المحاسبي
      // ما لم يرسل المستدعي skipAccounting = true.
      // ============================================================

      const unpaidInvoices = await purchaseInvoicesCollection
        .query(
          Q.where("supplier_id", data.supplierId),
          Q.where("status", Q.oneOf(["approved", "partial"])),
          Q.sortBy("invoice_date", Q.asc),
        )
        .fetch();

      for (const invoice of unpaidInvoices) {
        if (remainingPayment <= 0) {
          break;
        }

        const unpaidOnInvoice = Math.max(invoice.total - invoice.paidAmount, 0);

        if (unpaidOnInvoice <= 0) {
          continue;
        }

        const allocationForThisInvoice = Math.min(
          remainingPayment,
          unpaidOnInvoice,
        );

        // --------------------------------------------------------
        // إنشاء PaymentAllocation
        // --------------------------------------------------------

        const allocation = paymentAllocationsCollection.prepareCreate((p) => {
          p.paymentVoucherId = voucher.id;
          p.allocatableType = "purchase_invoices";
          p.allocatableId = invoice.id;
          p.amount = allocationForThisInvoice;
        });

        preparedAllocations.push(allocation);
        allOperations.push(allocation);

        // --------------------------------------------------------
        // تحديث الفاتورة
        // --------------------------------------------------------

        const newPaidAmount = invoice.paidAmount + allocationForThisInvoice;

        const newStatus = newPaidAmount >= invoice.total ? "paid" : "partial";

        const invoiceUpdate = invoice.prepareUpdate((inv) => {
          inv.paidAmount = newPaidAmount;
          inv.status = newStatus;
        });

        allOperations.push(invoiceUpdate);

        remainingPayment -= allocationForThisInvoice;
      }
    }

    // ============================================================
    // 4. التحقق من وجود مبلغ غير مخصص
    // ============================================================

    if (remainingPayment > 0 && preparedAllocations.length === 0) {
      throw new Error("لا توجد فواتير مستحقة لتخصيص مبلغ سند الصرف عليها.");
    }

    // ============================================================
    // 5. القيد المحاسبي
    // ============================================================
    //
    // سند الصرف التلقائي القادم من purchaseRepository:
    //
    // skipAccounting = true
    //
    // لأن PurchaseAccountingService سجل القيد بالفعل.
    //
    // أما سند الصرف المستقل:
    //
    // skipAccounting = false / undefined
    //
    // فيتم إنشاء قيده المحاسبي هنا.
    // ============================================================

    if (!data.skipAccounting) {
      const accountingOperations =
        await PaymentAccountingService.preparePaymentEntry(
          voucher,
          preparedAllocations,
        );

      allOperations.push(...accountingOperations);
    }

    return allOperations;
  },

  /**
   * إنشاء سند صرف وتوزيع المبلغ تلقائياً على فواتير المورد
   * باستخدام FIFO.
   *
   * هذه الدالة تستخدم للسندات المستقلة.
   */
  createAndAllocateToSupplier: (data: CreateAndAllocateSupplierData) =>
    database.write(async () => {
      const operations =
        await paymentVoucherRepository.prepareCreateAndAllocateToSupplier(data);

      const voucher = operations[0] as PaymentVoucher;

      await database.batch(...operations);

      return voucher;
    }),

  /**
   * مراقبة جميع سندات الصرف.
   */
  observeAll: () =>
    paymentVouchersCollection.query(Q.sortBy("voucher_date", Q.desc)).observe(),

  /**
   * مراقبة سند صرف محدد.
   */
  observeById: (id: string) => paymentVouchersCollection.findAndObserve(id),

  /**
   * إلغاء سند صرف.
   */
  cancel: (id: string) =>
    database.write(async () => {
      const voucher = await paymentVouchersCollection.find(id);

      await voucher.update((item) => {
        item.status = "cancelled";
      });

      return voucher;
    }),

  /**
   * حذف سند صرف مسودة فقط.
   */
  deleteDraft: (id: string) =>
    database.write(async () => {
      const voucher = await paymentVouchersCollection.find(id);

      if (voucher.status !== "draft") {
        throw new Error("لا يمكن حذف سند معتمد أو ملغى");
      }

      await voucher.markAsDeleted();
    }),
};
