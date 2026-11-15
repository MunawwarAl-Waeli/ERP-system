/**
 * ReceiptVoucherService
نعم، نثبت ونعتمد ReceiptVoucherService بهذا التصميم كأساس نهائي للمبيعات في v1.

القرار المعتمد

1. سند القبض Aggregate مستقل: ReceiptVoucher + ReceiptAllocations.

2. كل مبلغ السند يجب توزيعه بالكامل على فاتورة أو عدة فواتير.

   SUM(allocations) === receipt.amount

3. لا توجد دفعات مقدمة أو مبالغ غير موزعة في v1:

   ACCOUNTING.ALLOW_ADVANCES = false

4. لا يجوز توزيع مبلغ أكبر من الرصيد المتبقي للفاتورة.

5. لا يجوز توزيع سند على فاتورة تخص عميلًا آخر.

6. الفاتورة يجب أن تكون مُرحّلة وقابلة للتحصيل، وليست Draft أو Cancelled.

7. customer_id في سند القبض يبقى اختياريًا على مستوى الـSchema، لكن يصبح مطلوبًا عند وجود توزيعات على فواتير العملاء.

8. paid_amount في SalesInvoice Cache وليس مصدر الحقيقة المطلق:

   - الدفع الفوري من الفاتورة يدخل ضمن المدفوع.
   - الدفعات اللاحقة تأتي من receipt_allocations.

9. لا ننشئ ReceiptVoucher تلقائيًا عند بيع Cash أو Partial؛ لأن الدفع الفوري يدخل في قيد المبيعات نفسه.

10. عند سند قبض لاحق:

Dr Cash/Bank
    Cr Customer Receivable

11. رقم RV الرسمي لا يدخل عند إنشاء Draft، بل يولد عند Post داخل نفس الـUoW.

12. كل العمليات داخل UnitOfWork، والـRepository لا ينشئ قيودًا محاسبية ولا يدير FIFO أو الذمم بنفسه.

الشكل النهائي

ReceiptVoucherService
│
├── createDraft()
│
├── updateDraft()
│
├── post()
│   │
│   ├── Validate Draft
│   ├── Validate Customer
│   ├── Validate Payment Account
│   ├── Load Invoices
│   ├── Validate Invoice Ownership
│   ├── Validate Invoice Status
│   ├── Calculate Outstanding
│   ├── Validate Allocations
│   ├── Validate Full Distribution
│   ├── Generate RV Number
│   ├── Persist Voucher + Allocations
│   ├── Create Journal Entry
│   └── Post Journal
│
└── cancel()
    └── لاحقًا بعد اعتماد آلية عكس سند القبض

تم اعتماد هذا التصميم. ولا نحتاج إعادة فتح هذه النقاط أثناء تنفيذ الخدمة إلا إذا ظهر تعارض حقيقي مع الكود أو قاعدة البيانات.

الآن ننتقل إلى ReceiptVoucherService النهائي ثم بعدها SalesInvoiceServiceImpl.
    └── لاحقًا بعد اعتماد آلية عكس سند القبض
 */
import { Model, Relation, Query } from "@nozbe/watermelondb";
import {
  field,
  text,
  date,
  relation,
  children,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import ChartOfAccount from "./ChartOfAccount";
import Customer from "./Customer";
import ReceiptAllocation from "./ReceiptAllocation";
import { DocumentStatus } from "@core/constants";

export default class ReceiptVoucher extends Model {
  static table = "receipt_vouchers";

  static associations: Associations = {
    payment_accounts: {
      type: "belongs_to" as const,
      key: "payment_account_id",
    },

    customers: {
      type: "belongs_to" as const,
      key: "customer_id",
    },

    receipt_allocations: {
      type: "has_many" as const,
      foreignKey: "receipt_voucher_id",
    },
  };

  @text("voucher_number")
  voucherNumber?: string | null;

  @date("voucher_date")
  voucherDate!: number;

  @relation("payment_accounts", "payment_account_id")
  paymentAccount!: Relation<ChartOfAccount>;

  @relation("customers", "customer_id")
  customer!: Relation<Customer>;

  @field("amount")
  amount!: number;

  @text("description")
  description?: string | null;

  @text("status")
  status!: DocumentStatus;

  @text("created_by")
  createdBy!: string;

  @text("idempotency_key")
  idempotencyKey?: string | null;

  @field("is_cancelled")
  isCancelled!: boolean;

  @date("cancelled_at")
  cancelledAt?: number | null;

  @children("receipt_allocations")
  allocations!: Query<ReceiptAllocation>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
