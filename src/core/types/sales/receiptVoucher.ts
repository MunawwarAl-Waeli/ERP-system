import { DocumentStatus } from "@core/constants";

export interface ReceiptAllocationInput {
  salesInvoiceId: string;
  amount: number;
}

export interface CreateReceiptVoucherInput {
  voucherDate: string;
  paymentAccountId: string;
  customerId?: string;
  amount: number;
  description?: string;
  createdBy: string;
  idempotencyKey?: string;
}

export interface ReceiptAllocationData {
  id: string;
  salesInvoiceId: string;
  amount: number;
}

export interface ReceiptVoucherData {
  id: string;
  voucherNumber?: string|null;
  voucherDate: string;
  paymentAccountId: string;
  customerId?: string ;
  amount: number;
  description?: string ;
  status: DocumentStatus;
  createdBy: string;
  idempotencyKey?: string;
  isCancelled: boolean;
  cancelledAt?: string ;
  allocations: ReceiptAllocationData[];
  createdAt: number;
  updatedAt: number;
}

export interface PostReceiptVoucherInput {
  id: string;
  voucherNumber: string;
  allocations: ReceiptAllocationInput[];
}

// لماذا customerId إجباري؟

// لأننا اعتمدنا في الـ Schema:

// receipt_vouchers.customer_id → REQUIRED

// وسند القبض عندنا يمثل تحصيلاً من عميل، وليس حركة نقدية عامة.

// أما المقبوضات التي لا ترتبط بعميل فهذه حالة محاسبية مختلفة، ولا نخلطها بهذا الـ Aggregate.

// ---

// 3. Contract

// الملف:

// src/features/sales/repositories/ReceiptVoucherRepository.ts

// ---

// 4. لماذا persistPosted()؟

// نفس القرار الذي اتخذناه في PaymentVoucher.

// لا نريد:

// markPosted(id)

// لأن هذا يسمح نظريًا بوجود:

// ReceiptVoucher = POSTED
// ReceiptAllocation = لا يوجد

// بينما السند المنشور يجب أن يحمل توزيع التحصيل.

// لذلك:

// persistPosted({
//   id,
//   allocations,
// })

// يجعل الـ TypeScript نفسه يجبر الـ Service على توفير الـ allocations.

// ---

// 5. من يقرر توزيع القبض؟

// ليس الـ Repository.

// مثلاً العميل لديه:

// فاتورة SI-001
// Total       100,000
// Paid         20,000
// Outstanding  80,000

// فاتورة SI-002
// Total        60,000
// Paid          0
// Outstanding  60,000

// فاتورة SI-003
// Total        40,000
// Paid          0
// Outstanding  40,000

// والعميل دفع:

// 150,000

// الـ Domain:

// oldestFirstAllocation()

// ينتج:

// SI-001 → 80,000
// SI-002 → 60,000
// SI-003 → 10,000

// ثم الـ Service يمرر هذه النتيجة إلى Repository.

// الـ Repository لا يعرف لماذا SI-001 قبل SI-002.

// ---

// 6. الـ Domain لا يعرف Customer ولا SalesInvoice

// وهذه نقطة مهمة جدًا.

// oldestFirstAllocation يجب أن يبقى عاماً:

// interface OutstandingDocument {
//   id: string;
//   outstandingAmount: number;
//   date: string;
// }

// ثم:

// SalesInvoiceData[]
//        ↓
// تحويل إلى OutstandingDocument[]
//        ↓
// oldestFirstAllocation()
//        ↓
// ReceiptAllocationInput[]

// وبذلك يبقى الـ Domain:

// مستقلًا عن WatermelonDB

// مستقلًا عن Models

// مستقلًا عن React Native

// مستقلًا عن Customer

// قابلًا للاختبار بسهولة

// ---

// 7. تحديث SalesInvoice.paidAmount

// هنا نكرر نفس المبدأ الذي اعتمدناه في المشتريات.

// ReceiptAllocation هو:

// > Source of Truth

// بينما:

// SalesInvoice.paidAmount

// هو:

// > Cache

// لذلك نحتاج في SalesInvoiceRepository عملية:

// increasePaidAmount(
//   id: string,
//   amount: number,
// ): Promise<SalesInvoiceData>;

// ولا أنصح إطلاقًا بهذا:

// setPaidAmount(id, newAmount)

// لأن الـ Service قد يقرأ قيمة قديمة ثم يكتب قيمة غير صحيحة.

// أما:

// increasePaidAmount()

// فمعناه واضح:

// > أضف قيمة هذا التحصيل إلى الـ Cache.

// ويتم ذلك داخل نفس الـ Transaction.

// ---

// 8. دورة Posting كاملة

// الصورة المعمارية تكون:

// postReceiptVoucher()
//         │
//         ▼
// UnitOfWork.execute()
//         │
//         ├── قراءة ReceiptVoucher Draft
//         │
//         ├── قراءة فواتير العميل المفتوحة
//         │
//         ├── oldestFirstAllocation()
//         │
//         │     SI-001 → 80,000
//         │     SI-002 → 60,000
//         │     SI-003 → 10,000
//         │
//         ├── ReceiptVoucherRepository
//         │     persistPosted()
//         │
//         ├── SalesInvoiceRepository
//         │     increasePaidAmount()
//         │
//         ├── JournalEntryRepository
//         │     إنشاء قيد التحصيل
//         │
//         └── COMMIT

// إذا فشل أي جزء:

// ROLLBACK

// فتبقى قاعدة البيانات متسقة.

// ---

// 9. القيد المحاسبي

// الـ Repository لا ينشئه.

// الـ Service هو الذي ينسق:

// مدين:
//     الصندوق / البنك

// دائن:
//     حساب العملاء

// مثلاً قبض 150,000:

// من حـ/ الصندوق       150,000
//     إلى حـ/ العملاء       150,000

// والـ JournalEntryRepository مسؤول فقط عن حفظ القيد وترحيله وفق عقده.

// ---

// 10. نقطة مهمة: منع الـ Overpayment

// لدينا في الثوابت:

// ACCOUNTING.ALLOW_OVERPAYMENT = false

// لكن لا نضع هذا القرار داخل ReceiptVoucherRepository.

// الـ Service/Domain يتحقق أن:

// مجموع Allocations
// ≤
// إجمالي المستحقات

// وبالإضافة إلى ذلك:

// مجموع Allocations
// =
// ReceiptVoucher.amount

// مثلاً:

// Receipt = 150,000

// Allocations:
// 80,000
// 60,000
// 10,000

// Total = 150,000

// صحيح.

// أما:

// Receipt = 150,000

// Allocations:
// 80,000
// 60,000

// Total = 140,000

// فهذا غير صالح للـ Posting.

// ---

// 11. لا نضع Allocation في CreateReceiptVoucherInput

// هذه نقطة مقصودة.

// عند إنشاء السند:

// createDraft({
//   voucherNumber,
//   voucherDate,
//   paymentAccountId,
//   customerId,
//   amount,
//   ...
// })

// ثم عند الترحيل:

// persistPosted({
//   id,
//   allocations,
// })

// لأن التوزيع قد يعتمد على الوضع الفعلي للفواتير المفتوحة لحظة الترحيل.

// وهذا يمنع مشكلة مثل:

// 10:00
// أنشأت السند

// 10:05
// تغيرت مستحقات العميل

// 10:10
// رحلت السند

// فيقوم الـ Service بإعادة حساب التوزيع وقت الـ Posting.

// ---

// 12. العلاقة مع UnitOfWork

// إذن عندنا الآن خط متكامل:

// UnitOfWork
//                      │
//           ┌──────────┼──────────┐
//           ▼          ▼          ▼
//  ReceiptVoucher   SalesInvoice  JournalEntry
//  Repository       Repository    Repository
//       │                │             │
//       ▼                ▼             ▼
//  Allocation       paidAmount       Journal

// والـ Transaction تشمل الثلاثة.

// وهذا مهم جدًا لأننا لا نريد:

// ReceiptVoucher = POSTED
// Allocation = موجود
// paidAmount = لم يتحدث
// Journal = لم يُنشأ

// ---

// القرار النهائي لـ ReceiptVoucherRepository

// نعتمد:

// ReceiptVoucher
// └── ReceiptAllocation[]

// مع:

// createDraft()
// updateDraft()
// persistPosted()
// markCancelled()

// واستعلامات:

// getById()
// getByNumber()
// getByCustomer()
// getByDateRange()
// getDrafts()
// getPosted()

// والتوزيع يتم بواسطة:

// oldestFirstAllocation()

// وتحديث SalesInvoice.paidAmount يتم بواسطة:

// SalesInvoiceRepository.increasePaidAmount()

// داخل نفس:

// UnitOfWork

// بهذا أصبح لدينا الآن زوج متناسق جدًا:

// PaymentVoucher → PaymentAllocation → PurchaseInvoice.paidAmount

// ReceiptVoucher → ReceiptAllocation → SalesInvoice.paidAmount

// وهذا يحافظ على نفس المنطق في طرفي الحسابات المدينة والدائنة بدون تكرار مسؤوليات داخل الـ Repositories.
