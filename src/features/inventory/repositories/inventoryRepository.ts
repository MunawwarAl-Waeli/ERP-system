import { database } from "@core/database";
import Product from "@core/database/models/Product";
import StockMovement, {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  StockMovementType,
} from "@core/database/models/StockMovement";
import ProductBatch from "@core/database/models/ProductBatch"; // تأكد من وجود هذا الملف
import { map } from "rxjs/operators";
import { Model, Q } from "@nozbe/watermelondb";

// ============================
// تعريف المجموعات (Collections)
// ============================
const productsCollection = database.get<Product>("products");
const stockMovementsCollection = database.get<StockMovement>("stock_movements");
const productBatchesCollection = database.get<ProductBatch>("product_batches");

interface HandlePurchaseData {
  productId: string;
  productUnitId?: string;
  purchaseItemId?: string;
  quantity: number;
  unitCost: number;
}
// ============================
// الـ Repository
// ============================
export const inventoryRepository = {
  // ----------------------------------------------
  // 1. دوال المراقبة (Observables)
  // ----------------------------------------------

  /**
   * مراقبة حركات منتج معين (سجل التدقيق)
   */
  observeProductMovements: (productId: string) =>
    stockMovementsCollection
      .query(
        Q.where("product_id", productId),
        Q.sortBy("movement_date", Q.desc),
      )
      .observe(),

  /**
   * مراقبة رصيد المنتج الحالي (يعتمد على الدفعات)
   * - هذه هي الطريقة الصحيحة بعد إضافة product_batches
   */
  observeProductStock: (productId: string) =>
    productBatchesCollection
      .query(Q.where("product_id", productId))
      .observe()
      .pipe(
        map((batches) =>
          batches.reduce((stock, batch) => stock + batch.quantityRemaining, 0),
        ),
      ),

  /**
   * مراقبة جميع حركات المخزون
   */
  observeAllMovements: () =>
    stockMovementsCollection.query(Q.sortBy("movement_date", Q.desc)).observe(),

  // ----------------------------------------------
  // 2. دوال القراءة (Async)
  // ----------------------------------------------

  /**
   * الحصول على رصيد المنتج الحالي (مرة واحدة)
   */
  getProductStock: async (productId: string): Promise<number> => {
    const batches = await productBatchesCollection
      .query(Q.where("product_id", productId))
      .fetch();

    return batches.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
  },

  /**
   * آخر تكلفة شراء للمنتج (من أحدث حركة purchase_in)
   */
  getLastPurchaseCost: async (productId: string): Promise<number> => {
    const movement = await stockMovementsCollection
      .query(
        Q.where("product_id", productId),
        Q.where("movement_type", "purchase_in"),
        Q.sortBy("movement_date", Q.desc),
      )
      .fetch();

    return movement[0]?.unitCost ?? 0;
  },

  /**
   * التحقق من توفر كمية معينة من المنتج
   */
  isAvailable: async (
    productId: string,
    quantity: number,
  ): Promise<boolean> => {
    const stock = await inventoryRepository.getProductStock(productId);
    return stock >= quantity;
  },

  /**
   * الحصول على إجمالي قيمة المخزون (تكلفة البضاعة الموجودة)
   */
  getTotalInventoryValue: async (): Promise<number> => {
    const batches = await productBatchesCollection.query().fetch();
    return batches.reduce(
      (sum, batch) => sum + batch.quantityRemaining * batch.unitCost,
      0,
    );
  },

  /**
   * الحصول على الدفعات المتاحة لمنتج (quantity_remaining > 0)
   */
  getAvailableBatches: (productId: string): Promise<ProductBatch[]> =>
    productBatchesCollection
      .query(
        Q.where("product_id", productId),
        Q.where("quantity_remaining", Q.gt(0)),
        Q.sortBy("created_at", Q.asc), // الأقدم أولاً (FIFO)
      )
      .fetch(),

  /**
   * الحصول على جميع الدفعات لمنتج (بما فيها المستهلكة)
   */
  getAllBatches: (productId: string): Promise<ProductBatch[]> =>
    productBatchesCollection
      .query(Q.where("product_id", productId), Q.sortBy("created_at", Q.asc))
      .fetch(),

  // ----------------------------------------------
  // 3. دوال المعالجة (Write)
  // ----------------------------------------------

  /**
   * إنشاء حركة مخزون (عامة) - تُستخدم للتسجيل اليدوي إذا لزم الأمر
   * لكن يفضل استخدام الدوال المتخصصة أدناه
   */
  createMovement: (data: {
    productId: string;
    productUnitId?: string;
    quantity: number;
    movementType: StockMovementType;
    unitCost?: number;
    referenceType?: string;
    referenceId?: string;
    batchId?: string;
  }) =>
    database.write(() =>
      stockMovementsCollection.create((movement) => {
        movement.productId = data.productId;
        movement.productUnitId = data.productUnitId ?? "";
        movement.quantity = data.quantity;
        movement.movementType = data.movementType;
        movement.unitCost = data.unitCost ?? 0;
        movement.referenceType = data.referenceType ?? null;
        movement.referenceId = data.referenceId ?? null;
        movement.batchId = data.batchId ?? null;
        movement.movementDate = new Date();
      }),
    ),

  /**
   * Prepares records for a purchase transaction without committing them.
   * This function is side-effect-free.
   */
  prepareHandlePurchase: async (data: HandlePurchaseData) => {
    const operations = [];

    // 1. Prepare ProductBatch creation
    const batch = productBatchesCollection.prepareCreate((b) => {
      b.productId = data.productId;
      b.purchaseItemId = data.purchaseItemId ?? undefined;
      b.quantityReceived = data.quantity;
      b.quantityRemaining = data.quantity;
      b.unitCost = data.unitCost;
      b.createdAt = new Date();
    });
    operations.push(batch);

    // 2. Prepare StockMovement creation
    const movement = stockMovementsCollection.prepareCreate((m) => {
      m.productId = data.productId;
      m.batch.set(batch);
      m.quantity = data.quantity;
      m.movementType = "purchase_in";
      m.unitCost = data.unitCost;
      m.referenceType = "purchase_item";
      m.referenceId = data.purchaseItemId ?? null;
      m.movementDate = new Date();
    });
    operations.push(movement);

    // 3. Prepare Product update
    const product = await productsCollection.find(data.productId);
    operations.push(
      product.prepareUpdate((p) => {
        p.lastPurchaseCost = data.unitCost;
      }),
    );

    return operations;
  },

  /**
   * تحضير عكس دخول المخزون الناتج عن إلغاء بند شراء.
   *
   * هذه الدالة لا تقوم بأي كتابة مباشرة على قاعدة البيانات.
   * تقوم فقط بإعداد عمليات WatermelonDB لتدخل لاحقًا داخل
   * database.batch() واحد مع بقية عمليات إلغاء الفاتورة.
   *
   * منطق الإلغاء:
   *
   * 1. البحث عن جميع الدفعات المرتبطة ببند الشراء.
   * 2. التأكد أن الدفعات تخص المنتج المطلوب.
   * 3. منع الإلغاء المكرر.
   * 4. التحقق من أن الكمية المطلوبة يمكن عكسها بالكامل.
   * 5. خصم الكمية من quantityRemaining.
   * 6. إنشاء StockMovement عكسي لكل كمية تم خصمها.
   *
   * ملاحظة:
   * لا نحذف الـ Batch نفسه، لأن الـ Batch يمثل سجلًا تاريخيًا
   * لدخول البضاعة، وإنما نعدل quantityRemaining ونسجل حركة عكسية.
   */
  preparePurchaseCancellation: async (
    purchaseItemId: string,
    productId: string,
    quantity: number,
  ): Promise<Model[]> => {
    // ============================================================
    // 1. التحقق من المدخلات
    // ============================================================

    if (!purchaseItemId?.trim()) {
      throw new Error("معرف بند الشراء مطلوب لإلغاء المخزون.");
    }

    if (!productId?.trim()) {
      throw new Error("معرف المنتج مطلوب لإلغاء المخزون.");
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(
        `كمية الإلغاء غير صحيحة. يجب أن تكون الكمية أكبر من صفر. الكمية: ${quantity}`,
      );
    }

    // ============================================================
    // 2. جلب الدفعات المرتبطة ببند الشراء
    // ============================================================

    const batches = await productBatchesCollection
      .query(
        Q.where("purchase_item_id", purchaseItemId),
        Q.sortBy("created_at", Q.asc),
      )
      .fetch();

    if (batches.length === 0) {
      throw new Error(
        `لا توجد دفعات مخزون مرتبطة ببند الشراء ${purchaseItemId}.`,
      );
    }

    // ============================================================
    // 3. التحقق من أن جميع الدفعات تخص المنتج نفسه
    // ============================================================

    const invalidBatch = batches.find((batch) => batch.productId !== productId);

    if (invalidBatch) {
      throw new Error(
        `يوجد تعارض في بيانات المخزون. الدفعة ${invalidBatch.id} لا تخص المنتج ${productId}.`,
      );
    }

    // ============================================================
    // 4. منع الإلغاء المكرر
    //
    // نبحث عن حركات purchase_cancellation مرتبطة بنفس بند الشراء.
    // إذا وجدنا حركة سابقة فهذا يعني أن البند تم عكسه سابقًا.
    // ============================================================

    const previousCancellationMovements = await stockMovementsCollection
      .query(
        Q.where("reference_type", "purchase_cancellation"),
        Q.where("reference_id", purchaseItemId),
        Q.where("movement_type", "purchase_return"),
      )
      .fetch();

    if (previousCancellationMovements.length > 0) {
      throw new Error(
        `تم عكس المخزون لبند الشراء ${purchaseItemId} مسبقًا، ولا يمكن تنفيذ الإلغاء مرة أخرى.`,
      );
    }

    // ============================================================
    // 5. تحديد الكميات التي يمكن عكسها
    //
    // لا نقوم بإنشاء أي operation حتى نتأكد أن الكمية كاملة
    // قابلة للعكس.
    // ============================================================

    let remainingToCancel = quantity;

    const cancellationPlan: {
      batch: ProductBatch;
      quantity: number;
    }[] = [];

    for (const batch of batches) {
      if (remainingToCancel <= 0) {
        break;
      }

      const availableQuantity = Math.max(
        Number(batch.quantityRemaining) || 0,
        0,
      );

      if (availableQuantity <= 0) {
        continue;
      }

      const quantityToReverse = Math.min(availableQuantity, remainingToCancel);

      if (quantityToReverse <= 0) {
        continue;
      }

      cancellationPlan.push({
        batch,
        quantity: quantityToReverse,
      });

      remainingToCancel -= quantityToReverse;
    }

    // ============================================================
    // 6. التأكد من إمكانية عكس كامل الكمية
    // ============================================================

    if (remainingToCancel > 0.000001) {
      const availableForCancellation = quantity - remainingToCancel;

      throw new Error(
        `لا يمكن إلغاء كمية ${quantity} من المنتج ${productId}. ` +
          `الكمية المتاحة للعكس: ${availableForCancellation}. ` +
          `الكمية غير القابلة للعكس: ${remainingToCancel}. ` +
          `قد تكون بعض الكمية قد خرجت من المخزون أو تم استهلاكها.`,
      );
    }

    // ============================================================
    // 7. إنشاء عمليات WatermelonDB
    //
    // بعد نجاح جميع عمليات التحقق فقط نبدأ تجهيز العمليات.
    // ============================================================

    const operations: Model[] = [];

    const cancellationDate = new Date();

    for (const plan of cancellationPlan) {
      const { batch, quantity: quantityToReverse } = plan;

      // ----------------------------------------------------------
      // 7.1 خصم الكمية من الدفعة
      // ----------------------------------------------------------

      operations.push(
        batch.prepareUpdate((b) => {
          const currentRemaining = Number(b.quantityRemaining) || 0;

          if (currentRemaining < quantityToReverse) {
            throw new Error(
              `الكمية المتبقية في الدفعة ${batch.id} غير كافية لعكس الكمية المطلوبة.`,
            );
          }

          b.quantityRemaining = currentRemaining - quantityToReverse;
        }),
      );

      // ----------------------------------------------------------
      // 7.2 تسجيل حركة المخزون العكسية
      //
      // purchase_return هنا تعني خروج البضاعة التي دخلت أصلًا
      // بسبب فاتورة الشراء.
      // ----------------------------------------------------------

      operations.push(
        stockMovementsCollection.prepareCreate((movement) => {
          movement.productId = productId;
          movement.productUnitId = "";
          movement.batchId = batch.id;

          // خروج من المخزون => كمية سالبة
          movement.quantity = -quantityToReverse;

          movement.movementType = "purchase_return";

          // نستخدم تكلفة الدفعة الأصلية
          movement.unitCost = batch.unitCost;

          // ربط الحركة ببند الشراء الذي تم إلغاؤه
          movement.referenceType = "purchase_cancellation";
          movement.referenceId = purchaseItemId;

          movement.movementDate = cancellationDate;
        }),
      );
    }

    // ============================================================
    // 8. التأكد النهائي من أن الخطة تغطي كامل الكمية
    // ============================================================

    const plannedQuantity = cancellationPlan.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    if (Math.abs(plannedQuantity - quantity) > 0.000001) {
      throw new Error(
        `فشل تجهيز إلغاء المخزون لبند الشراء ${purchaseItemId}. ` +
          `المطلوب: ${quantity}، المجهز: ${plannedQuantity}.`,
      );
    }

    // ============================================================
    // 9. إرجاع العمليات فقط
    //
    // لا يوجد database.write() هنا.
    // المستدعي هو الذي يدمجها مع:
    //
    // - عكس القيد المحاسبي
    // - إلغاء سند الصرف
    // - عكس قيد سند الصرف
    // - تغيير حالة الفاتورة
    //
    // داخل database.batch() واحد.
    // ============================================================

    return operations;
  },
  /**
   * Executes a purchase transaction in its own atomic block.
   */

  handlePurchase: async (data: HandlePurchaseData) =>
    database.write(async () =>
      database.batch(
        ...(await inventoryRepository.prepareHandlePurchase(data)),
      ),
    ),

  /**
   * معالجة خروج المخزون (بيع) باستخدام FIFO
   * @returns إجمالي COGS (تكلفة البضاعة المباعة)
   * @throws إذا كانت الكمية غير متوفرة
   */
  prepareHandleSale: async (data: {
    productId: string;
    saleItemId?: string;
    quantity: number;
  }): Promise<{
    totalCost: number;
    unitCost: number;
    inventoryOperations: Model[];
  }> => {
    let remainingToDeduct = data.quantity;
    let totalCost = 0;

    const operations: Model[] = [];

    const batches = await productBatchesCollection
      .query(
        Q.where("product_id", data.productId),
        Q.where("quantity_remaining", Q.gt(0)),
        Q.sortBy("created_at", Q.asc),
      )
      .fetch();

    if (batches.length === 0) {
      throw new Error(`لا يوجد مخزون متاح للمنتج ${data.productId}`);
    }

    for (const batch of batches) {
      if (remainingToDeduct <= 0) {
        break;
      }

      const available = batch.quantityRemaining;

      const deducted = Math.min(available, remainingToDeduct);

      if (deducted <= 0) {
        continue;
      }

      totalCost += deducted * batch.unitCost;

      operations.push(
        batch.prepareUpdate((b) => {
          b.quantityRemaining -= deducted;
        }),
      );

      operations.push(
        stockMovementsCollection.prepareCreate((movement) => {
          movement.productId = data.productId;
          movement.batchId = batch.id;
          movement.quantity = -deducted;
          movement.movementType = "sale_out";
          movement.unitCost = batch.unitCost;
          movement.referenceType = "sale_item";
          movement.referenceId = data.saleItemId ?? null;
          movement.movementDate = new Date();
        }),
      );

      remainingToDeduct -= deducted;
    }

    if (remainingToDeduct > 0) {
      throw new Error(
        `الكمية المطلوبة (${data.quantity}) غير متوفرة للمنتج ${data.productId}. المتبقي: ${remainingToDeduct}`,
      );
    }

    const unitCost = data.quantity > 0 ? totalCost / data.quantity : 0;

    return {
      totalCost,
      unitCost,
      inventoryOperations: operations,
    };
  },

  /**
   * معالجة مرتجع مشتريات (إعادة كمية إلى الدفعة الأصلية)
   */
  handlePurchaseReturn: async (
    productId: string,
    originalBatchId: string,
    quantity: number,
  ) => {
    await database.write(async () => {
      const batch = await productBatchesCollection.find(originalBatchId);
      await batch.update((b) => {
        b.quantityRemaining += quantity;
      });

      await stockMovementsCollection.create((movement) => {
        movement.productId = productId;
        movement.batchId = batch.id;
        movement.quantity = quantity;
        movement.movementType = "purchase_return";
        movement.unitCost = batch.unitCost;
        movement.referenceType = "purchase_return";
        movement.movementDate = new Date();
      });
    });
  },

  /**
   * معالجة مرتجع مبيعات (استعادة الكمية إلى الدُفعات التي خرجت منها)
   * تعيد الكمية إلى الدُفعات التي استُهلكت في عملية البيع الأصلية
   */
  prepareHandleSaleReturn: async (
    productId: string,
    saleItemId: string,
    quantity: number,
  ) => {
    await database.write(async () => {
      // نبحث عن حركات الخروج المرتبطة ببند البيع (الأحدث أولاً)
      const movements = await stockMovementsCollection
        .query(
          Q.where("product_id", productId),
          Q.where("reference_type", "sale_item"),
          Q.where("reference_id", saleItemId),
          Q.where("movement_type", "sale_out"),
          Q.sortBy("movement_date", Q.desc),
        )
        .fetch();

      let remainingToRestore = quantity;

      for (const movement of movements) {
        if (remainingToRestore <= 0) {
          break;
        }

        const absQuantity = Math.abs(movement.quantity);
        const restored = Math.min(absQuantity, remainingToRestore);

        // تحديث الدفعة
        const batch = await productBatchesCollection.find(movement.batchId!);
        await batch.update((b) => {
          b.quantityRemaining += restored;
        });

        // تسجيل حركة مرتجع
        await stockMovementsCollection.create((m) => {
          m.productId = productId;
          m.batchId = batch.id;
          m.quantity = restored;
          m.movementType = "sale_return";
          m.unitCost = batch.unitCost;
          m.referenceType = "sale_item";
          m.referenceId = saleItemId;
          m.movementDate = new Date();
        });

        remainingToRestore -= restored;
      }

      if (remainingToRestore > 0) {
        throw new Error(
          `لم نتمكن من استعادة الكمية بالكامل. المتبقي: ${remainingToRestore}`,
        );
      }
    });
  },

  /**
   * تعديل المخزون يدوياً (زيادة أو نقصان)
   * @param quantity عدد موجب للزيادة، سالب للنقصان
   */
  adjustStock: async (productId: string, quantity: number) => {
    await database.write(async () => {
      const product = await productsCollection.find(productId);
      const absQty = Math.abs(quantity);

      if (quantity > 0) {
        // زيادة: دفعة جديدة بسعر آخر تكلفة شراء
        const batch = await productBatchesCollection.create((b) => {
          b.productId = productId;
          b.purchaseItemId = undefined;
          b.quantityReceived = absQty;
          b.quantityRemaining = absQty;
          b.unitCost = product.lastPurchaseCost || 0;
          b.createdAt = new Date();
        });

        await stockMovementsCollection.create((m) => {
          m.productId = productId;
          m.batchId = batch.id;
          m.quantity = absQty;
          m.movementType = "adjustment_in";
          m.unitCost = batch.unitCost;
          m.referenceType = "manual";
          m.movementDate = new Date();
        });
      } else {
        // نقصان: استهلاك من الدُفعات الأقدم (FIFO)
        let remaining = absQty;
        const batches = await productBatchesCollection
          .query(
            Q.where("product_id", productId),
            Q.where("quantity_remaining", Q.gt(0)),
            Q.sortBy("created_at", Q.asc),
          )
          .fetch();

        for (const batch of batches) {
          if (remaining <= 0) {
            break;
          }
          const deducted = Math.min(batch.quantityRemaining, remaining);

          await batch.update((b) => {
            b.quantityRemaining -= deducted;
          });

          await stockMovementsCollection.create((m) => {
            m.productId = productId;
            m.batchId = batch.id;
            m.quantity = -deducted;
            m.movementType = "adjustment_out";
            m.unitCost = batch.unitCost;
            m.referenceType = "manual";
            m.movementDate = new Date();
          });

          remaining -= deducted;
        }

        if (remaining > 0) {
          throw new Error(`الرصيد غير كافٍ للخصم. المتبقي: ${remaining}`);
        }
      }
    });
  },

  // ----------------------------------------------
  // 4. دوال التقارير والإحصائيات
  // ----------------------------------------------

  /**
   * الحصول على المنتجات منخفضة المخزون (الرصيد <= الحد الأدنى)
   */
  getLowStockProducts: async (): Promise<Product[]> => {
    const products = await productsCollection
      .query(Q.where("is_active", true))
      .fetch();

    const result: Product[] = [];
    for (const product of products) {
      const stock = await inventoryRepository.getProductStock(product.id);
      if (stock <= product.minStock) {
        result.push(product);
      }
    }
    return result;
  },

  /**
   * الحصول على المنتجات التي نفد مخزونها (الرصيد <= 0)
   */
  getOutOfStockProducts: async (): Promise<Product[]> => {
    const products = await productsCollection
      .query(Q.where("is_active", true))
      .fetch();

    const result: Product[] = [];
    for (const product of products) {
      const stock = await inventoryRepository.getProductStock(product.id);
      if (stock <= 0) {
        result.push(product);
      }
    }
    return result;
  },

  /**
   * الحصول على حركات منتج معين مع إمكانية التصفية (نوع الحركة، الفترة)
   */
  getProductMovements: (
    productId: string,
    filters?: {
      movementType?: StockMovementType;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<StockMovement[]> => {
    let query = stockMovementsCollection.query(
      Q.where("product_id", productId),
    );

    if (filters?.movementType) {
      query = query.extend(Q.where("movement_type", filters.movementType));
    }

    if (filters?.startDate) {
      query = query.extend(
        Q.where("movement_date", Q.gte(filters.startDate.getTime())),
      );
    }

    if (filters?.endDate) {
      query = query.extend(
        Q.where("movement_date", Q.lte(filters.endDate.getTime())),
      );
    }

    query = query.extend(Q.sortBy("movement_date", Q.desc));
    return query.fetch();
  },
};
