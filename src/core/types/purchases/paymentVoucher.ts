

import {
  DocumentStatus,
} from "../../constants";

export interface PaymentAllocationInput {
  purchaseInvoiceId: string;
  amount: number;
}

export interface CreatePaymentVoucherInput {
  voucherNumber: string;
  voucherDate: string;
  paymentAccountId: string;
  supplierId?: string;
  amount: number;
  description?: string;
  createdBy: string;
  idempotencyKey?: string;
}

export interface PaymentAllocationData {
  id: string;
  purchaseInvoiceId: string;
  amount: number;
}

export interface PaymentVoucherData {
  id: string;
  voucherNumber: string;
  voucherDate: string;
  paymentAccountId: string;
  supplierId: string;
  amount: number;
  description?: string;
  status: DocumentStatus;
  createdBy: string;
  idempotencyKey?: string;
  isCancelled: boolean;
  cancelledAt?: string;
  allocations: PaymentAllocationData[];
  createdAt: number;
  updatedAt: number;
}

export interface PostPaymentVoucherInput {
  id: string;
  allocations: PaymentAllocationInput[];
}

// لماذا لا نضع allocations في CreatePaymentVoucherInput؟

// لأن إنشاء السند شيء، وتحديد كيفية توزيع السداد شيء آخر.

// السيناريو:

// createDraft()
//        ↓
// PaymentVoucher Draft
//        ↓
// Service يقرأ فواتير المورد المفتوحة
//        ↓
// oldestFirstAllocation()
//        ↓
// allocations
//        ↓
// persistPosted()

// وهذا يجعل الـ Domain هو المسؤول عن القرار.


// ---

// 3. Contract النهائي



// 4. لماذا persistPosted() وليس markPosted()؟

// نفس فلسفة المبيعات، لكن هنا السبب مختلف قليلاً.

// لو كتبنا:

// markPosted(id)

// فيمكن نظرياً أن يحدث:

// PaymentVoucher = POSTED
// PaymentAllocation = لا توجد

// وهذا غير مقبول؛ لأن السند المنشور يجب أن يكون مرتبطاً بتوزيع السداد.

// لذلك:

// persistPosted({
//   id,
//   allocations,
// })

// يجعل الـ Contract نفسه يقول:

// > لا يوجد Posting لسند الصرف بدون Allocation.



// وهذا مهم جداً.


// ---

// 5. أين يتم تحديث PurchaseInvoice.paidAmount؟

// هنا النقطة التي يجب ألا نخلط فيها بين Cache و Source of Truth.

// لا أريد أن يكون:

// PaymentVoucherRepository
//         ↓
// PurchaseInvoiceRepository
//         ↓
// تعديل paidAmount

// لأن هذا يربط Repository بآخر ويكسر الحدود.

// الصحيح:

// PaymentVoucherService
//         │
//         ├── PaymentVoucherRepository
//         │
//         ├── PurchaseInvoiceRepository
//         │
//         ├── JournalEntryRepository
//         │
//         └── UnitOfWork

// والـ Service يستخدم الـ allocations كحقيقة العملية.

// مثلاً:

// فاتورة PI-001
// Total = 100,000
// Paid = 20,000
// Outstanding = 80,000

// فاتورة PI-002
// Total = 50,000
// Paid = 0
// Outstanding = 50,000

// Payment = 100,000

// الـ Domain:

// PI-001 → 80,000
// PI-002 → 20,000

// ثم الـ Service ينفذ داخل Transaction واحدة:

// PaymentVoucherRepository
//     persistPosted()
//         ↓
// PaymentAllocation
//     PI-001 = 80,000
//     PI-002 = 20,000

// PurchaseInvoiceRepository
//     updatePaidAmount()
//         PI-001 → 100,000
//         PI-002 → 20,000

// JournalEntryRepository
//     إنشاء قيد السداد


// ---

// 6. لكن هناك تعديل مهم على PurchaseInvoiceRepository

// بما أن paidAmount Cache، نحتاج عملية Persistence صغيرة له.

// لا أريد:

// updatePaidAmount(
//   invoiceId,
//   amount,
// )

// إذا كان amount يعني "القيمة الجديدة"، لأن هذا قد يؤدي إلى overwrite خاطئ.

// الأكثر أماناً:

// increasePaidAmount(
//   invoiceId: string,
//   amount: number,
// ): Promise<PurchaseInvoiceData>;

// لكن حتى هذا يحتاج قاعدة مهمة:

// > الـ Service لا يستنتج paidAmount من قيمة قديمة يقرأها ثم يكتبها؛ بل Repository ينفذ زيادة ذرية داخل نفس Transaction.



// إذن يصبح عقد PurchaseInvoiceRepository:

// increasePaidAmount(
//   id: string,
//   amount: number,
// ): Promise<PurchaseInvoiceData>;

// وهذا ليس Business Logic.

// هو مجرد:

// > "زد الـ cache بهذا المبلغ."



// أما هل المبلغ صحيح؟
// فالـ Service والـ Domain مسؤولان عن ذلك.


// ---

// 7. التدفق الكامل

// postPaymentVoucher()
//         │
//         ▼
// UnitOfWork.execute()
//         │
//         ├── 1. قراءة PaymentVoucher Draft
//         │
//         ├── 2. قراءة فواتير المورد المفتوحة
//         │
//         ├── 3. oldestFirstAllocation()
//         │
//         │       PI-001 → 80,000
//         │       PI-002 → 20,000
//         │
//         ├── 4. PaymentVoucherRepository
//         │       persistPosted()
//         │
//         ├── 5. PurchaseInvoiceRepository
//         │       increasePaidAmount()
//         │
//         ├── 6. JournalEntryRepository
//         │       إنشاء قيد السداد
//         │
//         └── COMMIT

// إذا فشل أي شيء:

// ROLLBACK

// ولا يصبح عندنا:

// سند صرف منشور
// +
// توزيعات ناقصة
// +
// paidAmount خاطئ
// +
// قيد محاسبي ناقص

// وهذا هو سبب إصرارنا على UnitOfWork.


// ---

// 8. نقطة مهمة جداً: لا تجعل oldestFirstAllocation يعرف الفواتير

// لا نريد:

// oldestFirstAllocation(purchaseInvoices, amount)

// إذا كان النوع مرتبطاً بـ PurchaseInvoiceData.

// الأفضل أن يبقى Domain عاماً:

// interface OutstandingDocument {
//   id: string;
//   outstandingAmount: number;
//   date: string;
// }

// ثم:

// oldestFirstAllocation(
//   documents,
//   paymentAmount,
// )

// وبالتالي نفس الـ Domain يمكن استخدامه مستقبلاً مع:

// Customer Receipts
// Supplier Payments

// دون ربطه بـ WatermelonDB أو Models أو Feature معين.


// ---

// القرار المعماري النهائي

// أعتمد هذا الشكل:

// PaymentVoucher Aggregate
// ├── PaymentVoucher
// └── PaymentAllocation[]

// Domain
// └── oldestFirstAllocation()

// Service
// └── postPaymentVoucher()
//       ├── PaymentVoucherRepository
//       ├── PurchaseInvoiceRepository
//       └── JournalEntryRepository

// UnitOfWork
// └── Transaction boundary

// والـ Repository لا يفكر:

// لا يختار أقدم فاتورة.

// لا يحسب Outstanding.

// لا يمنع Overpayment كقرار تجاري.

// لا ينشئ القيد المحاسبي.

// لا يقرر كيفية توزيع السداد.


// هو فقط يحفظ النتيجة التي قررها الـ Service/Domain.

// وأضيف increasePaidAmount() إلى PurchaseInvoiceRepository كعملية Cache persistence صريحة. بهذه الطريقة يبقى PaymentAllocation هو مصدر الحقيقة، بينما paidAmount مجرد Cache سريع للعرض والاستعلام.