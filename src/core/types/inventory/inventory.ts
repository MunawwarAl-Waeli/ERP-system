import { ReferenceType, StockMovementType } from "@core/constants";

export interface AvailableBatchData {
  id: string;
  productId: string;
  quantityRemaining: number;
  unitCost: number;
  receivedDate: string;
}

export interface CreateProductBatchInput {
  productId: string;
  purchaseItemId?: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  receivedDate: string;
}

export interface BatchQuantityChangeInput {
  batchId: string;
  quantity: number;
}

export interface StockMovementInput {
  productId: string;
  productUnitId: string;
  batchId?: string;
  quantity: number;
  movementType: StockMovementType;
  referenceType?: ReferenceType;
  referenceId?: string;
  unitCost: number;
  movementDate: string;
}

export interface StockMovementData {
  id: string;
  productId: string;
  productUnitId: string;
  batchId?: string;
  quantity: number;
  movementType: StockMovementType;
  referenceType?: ReferenceType;
  referenceId?: string;
  unitCost: number;
  movementDate: string;
}

// لكن بما أننا نريد Clean Contract فعليًا، يجب ألا نستورد الـ constants بطريقة عشوائية.

// الملف سيستخدم الأنواع المشتقة من الثوابت الموجودة عندنا:

// import {
//   ReferenceType,
//   StockMovementType,
// } from "../../constants";

// إذا كانت هذه الأنواع غير موجودة حاليًا في constants/index.ts، سنضيفها هناك لاحقًا، بدل استخدام string.


// ---

// 2. لماذا AvailableBatchData وليس ProductBatchData؟

// لأن الـ FIFO Domain لا يحتاج كل تفاصيل قاعدة البيانات.

// هو يحتاج فقط:

// id
// productId
// quantityRemaining
// unitCost
// receivedDate

// وبالتالي عندما يعمل:

// calculateFIFOAllocation(...)

// نمرر له البيانات اللازمة فقط.

// مثلاً:

// InventoryRepository
//         ↓
// getAvailableBatches()
//         ↓
// AvailableBatchData[]
//         ↓
// FIFO Domain
//         ↓
// Allocation[]

// وهذا فصل ممتاز بين Infrastructure وDomain.


// ---

// 3. Contract النهائي

// المسار:

// src/features/inventory/repositories/InventoryRepository.ts



// ---

// 4. لماذا consumeBatches() يأخذ Allocations جاهزة؟

// هذه أهم نقطة في العقد.

// الـ Service/Domain قد ينتج:

// [
//   {
//     batchId: "batch-001",
//     quantity: 20,
//   },
//   {
//     batchId: "batch-002",
//     quantity: 15,
//   },
// ]

// الـ Repository لا يسأل:

// > أي Batch أستخدم أولًا؟



// ولا يقوم بالـ FIFO.

// بل ينفذ القرار الذي اتخذه الـ Domain:

// Domain
//   ↓
// FIFO
//   ↓
// Batch 001 → 20
// Batch 002 → 15
//   ↓
// InventoryRepository.consumeBatches()

// وهذا بالضبط الفصل الذي نريده.


// ---

// 5. لماذا consumeBatches() وليس consumeBatch()؟

// لأن عملية البيع قد تستخدم:

// Batch A = 20
// Batch B = 30
// Batch C = 10

// بدل:

// consumeBatch(...)
// consumeBatch(...)
// consumeBatch(...)

// نرسل القرار كاملًا:

// consumeBatches(allocations);

// وهذا أفضل أيضًا للأداء، والأهم أنه يجعل العملية واضحة باعتبارها دفعة واحدة ضمن الـ Unit of Work.


// ---

// 6. restoreBatches() أهم مما يبدو

// هذه ليست FIFO.

// عند إرجاع مبيعات، اتفقنا أن الاستعادة تكون:

// > Last Consumed First



// مثلاً البيع الأصلي استهلك:

// Batch A → 20
// Batch B → 30
// Batch C → 10

// والعميل أعاد 25:

// Batch C ← 10
// Batch B ← 15

// من الذي يقرر ذلك؟

// returnBatchRestoration.ts في Domain.

// وليس InventoryRepository.

// ثم:

// inventoryRepository.restoreBatches([
//   { batchId: "batch-c", quantity: 10 },
//   { batchId: "batch-b", quantity: 15 },
// ]);

// Repository ينفذ فقط.


// ---

// 7. نقطة مهمة: لماذا لا نضع FIFO في getAvailableBatches()؟

// قد يكون من المغري كتابة:

// getAvailableBatches(productId)

// وتجعل Repository ترتب:

// receivedDate ASC

// لكنني لا أريد أن يكون ذلك جزءًا من القرار التجاري.

// الـ Repository يمكنه إرجاع البيانات بترتيب معين لأسباب تقنية، لكن قرار FIFO يجب أن يبقى صريحًا في Domain:

// getAvailableBatches()
//         ↓
// calculateFIFOAllocation()

// وبالتالي نستطيع لاحقًا تغيير طريقة التكلفة إلى:

// FIFO
// Weighted Average
// Specific Identification

// دون إعادة كتابة Repository.


// ---

// 8. createBatch() في المشتريات

// عند ترحيل شراء:

// PurchaseInvoiceService
//         │
//         ├── convert quantity → pieces
//         │
//         ├── calculate cost per piece
//         │
//         ▼
// InventoryRepository.createBatch()

// مثلاً:

// {
//   productId: "P001",
//   purchaseItemId: "PII001",
//   quantityReceived: 500,
//   quantityRemaining: 500,
//   unitCost: 1250,
//   receivedDate: "2026-09-25"
// }

// Repository لا يحسب:

// 500 × 1250

// ولا يقرر السعر.

// هذه الحسابات تمت قبل وصول البيانات إليه.


// ---

// 9. Stock Movement

// الحركة تكون مستقلة عن الـ Batch.

// مثلاً شراء:

// {
//   productId: "P001",
//   productUnitId: "piece",
//   batchId: "B001",
//   quantity: 500,
//   movementType: "purchase_in",
//   referenceType: "purchase_invoice",
//   referenceId: "PI001",
//   unitCost: 1250,
//   movementDate: "2026-09-25"
// }

// بيع:

// {
//   productId: "P001",
//   productUnitId: "piece",
//   batchId: "B001",
//   quantity: -100,
//   movementType: "sale_out",
//   referenceType: "sales_invoice",
//   referenceId: "SI001",
//   unitCost: 1250,
//   movementDate: "2026-09-25"
// }

// وإرجاع:

// {
//   productId: "P001",
//   productUnitId: "piece",
//   batchId: "B001",
//   quantity: 100,
//   movementType: "sale_return",
//   referenceType: "sales_return",
//   referenceId: "SR001",
//   unitCost: 1250,
//   movementDate: "2026-09-25"
// }

// لاحظ أن:

// > InventoryRepository لا يستنتج نوع الحركة من العملية.



// الـ Service يمرر movementType صراحة.


// ---

// 10. هل createMovements() ضرورية؟

// نعم.

// بيع واحد قد يستهلك عدة Batches:

// Sale 100 pieces

// Batch A → -40
// Batch B → -35
// Batch C → -25

// فتحتاج:

// createMovements([
//   movementA,
//   movementB,
//   movementC,
// ]);

// وهذا أفضل من جعل Service مسؤولًا عن تنفيذ عدة عمليات Persistence منفصلة.


// ---

// 11. لكن هناك تعديل مهم على StockMovementData

// نحتاج استيراد النوعين:

// import {
//   ReferenceType,
//   StockMovementType,
// } from "../../constants";

// وبالتالي لا نستخدم:

// movementType: string;
// referenceType?: string;

// أبدًا.

// نريد:

// movementType: StockMovementType;
// referenceType?: ReferenceType;

// للحفاظ على نفس مبدأ JournalEntryRepository.


// ---

// 12. ماذا عن منع المخزون السالب؟

// هنا يجب أن نكون دقيقين جدًا.

// لا نريد:

// InventoryRepository
//    ↓
// يقرر هل يوجد مخزون كافٍ
//    ↓
// يرفض العملية

// لأن قرار كفاية المخزون Business Rule.

// الـ FIFO Domain بالفعل يحصل على:

// available batches

// وإذا لم تكفِ:

// calculateFIFOAllocation(...)

// يرمي:

// InsufficientStockError

// قبل الوصول إلى:

// consumeBatches()

// لكن هناك حماية Persistence/Consistency إضافية يمكن أن يضعها Repository/DB لمنع نتيجة غير صالحة، مثل عدم السماح أن يصبح quantity_remaining < 0.

// وهذا ليس اتخاذ قرار FIFO؛ بل حماية سلامة البيانات.


// ---

// 13. الصورة الكاملة

// شراء

// PurchaseInvoiceService
//         │
//         ├── PurchaseInvoiceRepository
//         │
//         ├── InventoryRepository
//         │      ├── createBatch()
//         │      └── createMovement()
//         │
//         └── JournalEntryRepository

// بيع

// SalesInvoiceService
//         │
//         ├── SalesInvoiceRepository
//         │
//         ├── InventoryRepository
//         │      ├── getAvailableBatches()
//         │      ↓
//         │   FIFO Domain
//         │      ↓
//         │      ├── consumeBatches()
//         │      └── createMovements()
//         │
//         └── JournalEntryRepository

// مرتجع بيع

// SalesReturnService
//         │
//         ├── SalesReturnRepository
//         │
//         ├── InventoryRepository
//         │      ├── get...
//         │      ↓
//         │   Return Restoration Domain
//         │      ↓
//         │      ├── restoreBatches()
//         │      └── createMovements()
//         │
//         ├── CustomerRefundRepository
//         │
//         └── JournalEntryRepository


// ---

// القرار النهائي للمرحلة

// أعتمد التصميم بهذا الشكل:

// InventoryRepository
// ├── Batch Queries
// │   ├── getBatchById
// │   ├── getAvailableBatches
// │   └── getBatchesByProduct
// │
// ├── Batch Mutations
// │   ├── createBatch
// │   ├── consumeBatches
// │   └── restoreBatches
// │
// └── Stock Movements
//     ├── createMovement
//     ├── createMovements
//     ├── getMovementsByProduct
//     └── getMovementsByReference

// والقاعدة الثابتة:

// > InventoryRepository ينفذ قرارات المخزون، ولا يصنع قرارات المخزون.



// وهذا يجعل fifoAllocation.ts وreturnBatchRestoration.ts هما صاحبا القرار، بينما Repository مجرد منفذ Persistence.

// بعد اعتماد هذا العقد، المرحلة التالية المنطقية هي SalesInvoiceRepository وليس PaymentVoucherRepository؛ لأننا نحتاج الآن اختبار أصعب Aggregate عندنا:
// SalesInvoice + SalesInvoiceItems + SaleItemBatchConsumptions، وربطه مباشرةً بـ FIFO وInventoryRepository وJournalEntryRepository وUnitOfWork.