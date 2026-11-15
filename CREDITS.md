نعم. وبما أننا وصلنا الآن إلى نقطة جيدة في التصميم، الأفضل أن نوقف إضافة Repositories مؤقتًا وننفذ مراجعة معمارية شاملة قبل أن نبني أي مرحلة جديدة.

راجعت ما ثبتناه حتى الآن كمنظومة واحدة، وليس كل جزء منفصلًا. والنتيجة: الأساس المعماري قوي ومتناسق، لكن توجد عدة نقاط يجب حسمها قبل الدخول في Implementations الخاصة بـ WatermelonDB والـ Services. أهمها ليس إعادة تصميم الـ Schema، بل ضمان أن التنفيذ الفعلي لن يكسر الفصل الذي بنيناه.


---

أولاً: الصورة الكاملة التي وصلنا إليها

المعمارية الحالية:

UI / Screens
      │
      ▼
Application Services
      │
      ├──────────────► Domain
      │                  │
      │                  ├── FIFO
      │                  ├── Oldest First
      │                  ├── Unit Conversion
      │                  ├── Return Restoration
      │                  └── Journal Validation
      │
      ▼
Repositories
      │
      ▼
WatermelonDB
      │
      ▼
SQLite

والعملية المحاسبية الكاملة:

Screen
  ↓
Service
  ↓
Domain
  ↓
Repository
  ↓
UnitOfWork / Transaction
  ↓
WatermelonDB
  ↓
Journal + Operational Data

وهذا هو الاتجاه الصحيح.


---

ثانياً: الـ Schema الذي اعتمدناه

لدينا 26 جدولاً:

Accounting

accounting_periods
chart_of_accounts
accounting_settings
journal_entries
journal_entry_lines

Parties

customers
suppliers

Products & Inventory

categories
units
products
product_units
product_batches
stock_movements

Purchases

purchase_invoices
purchase_invoice_items
payment_vouchers
payment_allocations

Sales

sales_invoices
sales_invoice_items
sale_item_batch_consumptions
receipt_vouchers
receipt_allocations

Returns

sales_returns
sales_return_items
sales_return_batch_allocations
customer_refunds

المراجعة: لا أرى الآن جدولاً زائداً يجب حذفه، ولا جدولاً أساسياً مفقوداً في نطاق v1 الذي حددناه.


---

ثالثاً: الـ Aggregate Boundaries

ثبتنا هذه الحدود:

ChartOfAccount
└── ChartOfAccount children


JournalEntry
└── JournalEntryLine


Product
└── ProductUnit


PurchaseInvoice
└── PurchaseInvoiceItem


PaymentVoucher
└── PaymentAllocation


SalesInvoice
├── SalesInvoiceItem
└── SaleItemBatchConsumption


ReceiptVoucher
└── ReceiptAllocation


SalesReturn
├── SalesReturnItem
└── SalesReturnBatchAllocation


CustomerRefund

والـ Inventory:

ProductBatch
StockMovement

يُعامل كـ Operational Repository Boundary وليس Aggregate تقليدياً.

هذه النقطة صحيحة

والأهم أننا لم نقع في الخطأ الشائع:

26 tables
↓
26 repositories

وهذا قرار معماري جيد.


---

رابعاً: الـ Domain Layer

لدينا الآن:

core/domain/

accounting/
└── journalValidation.ts

inventory/
├── unitConversion.ts
├── fifoAllocation.ts
└── returnBatchRestoration.ts

payments/
└── oldestFirstAllocation.ts

وهنا أعتبر التصميم صحيحاً ومتماسكاً.

خصوصاً التفريق بين:

FIFO

و:

LIFO restoration

في المرتجعات.

فالبيع:

Batch A
Batch B
Batch C

FIFO:
A → B → C

أما إرجاع جزء من نفس البيع:

آخر Batch تم استهلاكه
↓
ثم الذي قبله
↓
ثم الذي قبله

وهذا ليس "FIFO عكسي" بالمعنى العام؛ بل إعادة عكس استهلاك البيع المسجل.


---

خامساً: المحاسبة

لدينا مبدأ مهم جداً:

Operational Action
       ↓
Service
       ↓
Journal Entry

وليس:

User
↓
Manual Journal
↓
Inventory

مثلاً البيع:

SalesInvoice
     │
     ├── Inventory
     ├── COGS
     ├── Customer Receivable
     └── Journal

والشراء:

PurchaseInvoice
     │
     ├── Inventory
     ├── Supplier Payable
     └── Journal

والتحصيل:

ReceiptVoucher
     │
     ├── ReceiptAllocation
     ├── Customer paidAmount cache
     └── Journal

والسداد:

PaymentVoucher
     │
     ├── PaymentAllocation
     ├── Supplier paidAmount cache
     └── Journal

هذا هو التصميم الذي نريد الحفاظ عليه.


---

سادساً: Source of Truth مقابل Cache

هذه من أهم النقاط التي ثبتناها.

المبيعات

الحقيقة:

ReceiptAllocation

والـ:

SalesInvoice.paidAmount

مجرد Cache.

المشتريات

الحقيقة:

PaymentAllocation

والـ:

PurchaseInvoice.paidAmount

Cache.

تكلفة البيع

الحقيقة:

SaleItemBatchConsumption

والـ:

SalesInvoiceItem.costAtSale

Cache / Aggregate Result.

هذه قاعدة ممتازة ويجب ألا نكسرها في التنفيذ.


---

سابعاً: الـ Repositories التي حُسمت

حتى الآن:

1. JournalEntryRepository

اعتمدناه.

وفيه:

getById
getByReference
getByIdempotencyKey
getByDateRange
getPostedByReference

createDraft
updateDraft
post
reverse

مع منع:

delete
updatePosted
unpost


---

2. PurchaseInvoiceRepository

اعتمدناه:

getById
getByNumber
getBySupplier
getByDateRange
getDrafts
getPosted

createDraft
updateDraft

markPosted
markCancelled
increasePaidAmount

والسبب في بقاء:

markPosted

هنا أن Purchase Invoice لا يحتاج إلى إلزام Repository بوجود Batch Consumptions داخل Aggregate.

فالـ Service هو الذي ينسق:

PurchaseInvoice
+
Inventory
+
Journal


---

3. InventoryRepository

اعتمدناه.

مسؤول عن:

getBatchById
getAvailableBatches
getBatchesByProduct

createBatch

consumeBatches
restoreBatches

createMovement
createMovements

getMovementsByProduct
getMovementsByReference

ولا يعرف:

FIFO
COGS policy
business decision

وهذا صحيح.


---

4. SalesInvoiceRepository

اعتمدناه.

والقرار المهم:

persistPosted(input)

بدلاً من:

markPosted(id)

لأن Posting البيع يجب أن يحمل:

SaleItemBatchConsumption[]

وهذا يحمي الـ Aggregate من أن يصبح:

Posted Sale
+
No COGS allocation


---

5. PaymentVoucherRepository

اعتمدناه.

PaymentVoucher
└── PaymentAllocation[]

والـ Domain:

oldestFirstAllocation()

والـ Service ينسق:

PaymentVoucher
+
PurchaseInvoice.paidAmount
+
Journal


---

6. ReceiptVoucherRepository

الآن اعتمدناه بنفس المنطق:

ReceiptVoucher
└── ReceiptAllocation[]

والـ Service ينسق:

ReceiptVoucher
+
SalesInvoice.paidAmount
+
Journal


---

ثامناً: توجد نقطة معمارية حرجة يجب حلها الآن

هذه أهم ملاحظة في المراجعة.

لدينا:

interface UnitOfWork {
  execute<T>(
    work: () => Promise<T>,
  ): Promise<T>;
}

وهذا ممتاز من ناحية الـ Core.

لكن عند التنفيذ باستخدام WatermelonDB يجب ألا تقع في هذا الخطأ:

UnitOfWork
   ↓
database.write()

Repository A
   ↓
database.write()

Repository B
   ↓
database.write()

Repository C
   ↓
database.write()

لأننا بذلك فقدنا معنى:

> Transaction واحدة للعملية كاملة.



قد تصبح كل Repository لها Write منفصلة.

التنفيذ الصحيح

يجب أن يكون:

UnitOfWork
    ↓
ONE WatermelonDB write
    ↓
Repository A
Repository B
Repository C
    ↓
COMMIT

لكن بدون تلويث Contracts بـ:

transaction?: any

أو:

Database

أو:

Model

وهذا مهم جداً.

إذن

Contract يبقى كما هو.

لكن في طبقة Infrastructure سنحتاج آلية تجعل Repositories المستخدمة داخل UnitOfWork مرتبطة بنفس transaction context الداخلي، دون أن يظهر ذلك في core أو في Interfaces.

هذه نقطة يجب أن نحسمها عند بناء Infrastructure، وليس الآن بإضافة transactionContext إلى كل Repository.


---

تاسعاً: نقطة ثانية مهمة — مسؤولية Posting

يجب أن نبقي قاعدة:

Repository ≠ Business Process

مثلاً لا نكتب:

salesInvoiceRepository.post()

ليقوم تلقائياً بـ:

FIFO
Inventory
COGS
Journal
Customer

الصحيح:

postSalesInvoice()

داخل Application Service.

وهو الذي يقوم:

1. Read Draft
2. Validate
3. Read batches
4. FIFO
5. Consume inventory
6. Create batch consumptions
7. Create stock movements
8. Build journal
9. Persist posted aggregate
10. Commit

وهذا مبدأ يجب أن نلتزم به في كل العمليات القادمة.


---

عاشراً: نقطة ثالثة — Idempotency

لدينا:

idempotency_key

في المستندات الرئيسية.

وهذا ممتاز.

لكن يجب أن يكون الاستخدام فعلياً وليس مجرد Column.

مثلاً:

postSalesInvoice()

إذا وصل الطلب مرتين بنفس:

idempotencyKey

يجب ألا يحدث:

FIFO مرتين
Stock movement مرتين
Journal مرتين

بل:

Existing operation
↓
Return existing result

وهذا يجب أن يدخل في تصميم الـ Services وRepositories لاحقاً.


---

الحادية عشرة: حالات الإلغاء والعكس

اعتمدنا:

Posted
↓
لا Delete

ولكن يجب التمييز بين:

Cancel Draft

مسموح:

Draft → Cancelled

Cancel Posted

ليس مجرد:

is_cancelled = true

إذا كان المستند أثّر فعلاً على:

المخزون

الحسابات

الصندوق

العملاء

الموردين


فإن إلغاءه يحتاج عملية عكسية.

مثلاً البيع المنشور:

Sale
↓
Stock Out
↓
COGS
↓
Receivable
↓
Journal

لا يكفي:

is_cancelled = true

بل نحتاج لاحقاً عملية:

Reverse Sales Invoice

تقوم بعكس الآثار.

لذلك

markCancelled() يجب أن يبقى Persistence operation فقط.

والـ Service هو الذي يقرر متى يكون الإلغاء مسموحاً وكيف تُعكس الآثار.

وهذا متسق مع التصميم الحالي.


---

الثانية عشرة: مشكلة يجب ألا نقع فيها في المرتجعات

عندما نصل إلى:

SalesReturn

لا ينبغي أن نستخدم:

fifoAllocation()

لإعادة البضاعة.

بل:

returnBatchRestoration()

ويقرأ:

SaleItemBatchConsumption

ثم يعيد الكمية إلى نفس الـ batches التي خرجت منها.

مثلاً:

Sale:

Batch A → 10
Batch B → 20
Batch C → 5

إرجاع 15:

Batch C ← 5
Batch B ← 10

وليس:

Batch A ← 15

حتى لو كان Batch A أقدم.

هذه نقطة محاسبية ومخزنية مهمة جداً.


---

الثالثة عشرة: الوحدات

اعتمدنا:

User Unit
     ↓
conversion_factor
     ↓
Base Unit = piece

مثلاً:

1 carton = 24 pieces

إذا باع المستخدم:

2 cartons

فالـ Domain يحولها:

48 pieces

ثم:

FIFO
Stock
Batch Consumption

كلها تعمل على:

48 pieces

وهذا صحيح.

لكن يجب التأكد لاحقاً أن:

unit price
unit cost
conversion factor

يتم تفسيرها بشكل موحد، خصوصاً عند الشراء والبيع والمرتجع.

هذه ستكون نقطة اختبار مهمة.


---

الرابعة عشرة: النقد والبنك

اعتمدنا:

paymentAccountId

في:

PaymentVoucher
ReceiptVoucher
CustomerRefund

وهذا قرار جيد.

لأن السند لا يحتاج أن يعرف:

Cash
Bank

كـ business logic.

بل يشير إلى:

ChartOfAccount

والحساب نفسه يحدد أنه:

is_cash_account

أو حساب بنك.


---

الخامسة عشرة: الخدمات التي ستظهر لاحقاً

بعد إنهاء الـ Repository Contracts، لا ينبغي أن نبدأ كتابة Screens.

الطبقة التالية ستكون Application Services.

وأهمها:

postPurchaseInvoice
postSalesInvoice

postPaymentVoucher
postReceiptVoucher

postSalesReturn
processCustomerRefund

cancelPurchaseInvoice
cancelSalesInvoice
cancelPaymentVoucher
cancelReceiptVoucher

لكن يجب ألا نكتبها دفعة واحدة.

كل Service يجب أن يمر بنفس القالب:

Validate
   ↓
Idempotency check
   ↓
Load aggregate
   ↓
Load external data
   ↓
Domain calculation
   ↓
Persistence operations
   ↓
Journal
   ↓
Cache updates
   ↓
Commit


---

السادسة عشرة: ما لم نحسمه بعد

وهنا أهم جزء في المراجعة.

لدينا بعض الأشياء التي لا أريد أن أعتبرها منتهية لمجرد أن Schema لها موجود.

A. Sales Returns

لم نكمل Repository بعد.

يجب أن يكون:

SalesReturn
├── SalesReturnItem
└── SalesReturnBatchAllocation

وسنحتاج تحديد طريقة Posting بدقة.


---

B. Customer Refund

لم نكمل Contract.

وهو Aggregate مستقل:

CustomerRefund

ويرتبط بـ:

SalesReturn
Customer
PaymentAccount


---

C. ProductRepository

لم نكمله.

وهنا يجب الانتباه لأن:

Product
└── ProductUnit

لكن:

ProductBatch
StockMovement

لا ينبغي جرّها إلى Product Aggregate.


---

D. Customer / Supplier / Category / Unit

لم نكمل عقودها.

لكن هذه أبسط بكثير من:

Sales
Purchases
Payments
Returns


---

E. AccountingSettings

لم نكمله.

وهذا مهم لأنه يحدد الحسابات الافتراضية مثل:

customers_account_id
suppliers_account_id
cash_default_account_id
bank_default_account_id


---

F. AccountingPeriod

لم نكمله.

وهو مهم قبل Posting الحقيقي، لأن Service يجب أن يعرف:

هل الفترة مفتوحة؟

قبل إنشاء قيد.


---

السابعة عشرة: Migration v1 → v2

هذه لم تنتهِ بمجرد اعتماد Schema v2.

نحتاج Migration حقيقية تشمل:

remove invoice_type
remove item_type
remove description
remove voucher reference_type/reference_id
remove service_revenue_account_id

add cancelled_at
add required customer_id
add required supplier_id

add:
sale_item_batch_consumptions
receipt_allocations
sales_returns
sales_return_items
sales_return_batch_allocations
customer_refunds

وهناك نقطة حساسة:

nullable → required

لا يمكن تنفيذها بلا معالجة البيانات القديمة.

خصوصاً:

receipt_vouchers.customer_id
payment_vouchers.supplier_id

لذلك الـ Migration تحتاج خطة Backfill/Validation، وليست مجرد تعديل Schema.


---

الثامنة عشرة: Models

لدينا 26 Model متوافقة مع الـ Schema.

وهذا جيد.

لكن يجب أن نحافظ على القاعدة:

Model
≠ Domain

أي لا نضع داخل Model:

calculateFIFO()
postInvoice()
allocatePayment()
createJournal()

الـ Model يمثل Persistence فقط.


---

التاسعة عشرة: ما أعتبره جاهزاً فعلياً

لو أردت أن أعطي المشروع الآن حالة معمارية:

الجزء	الحالة

Schema v2	✅ معتمد
26 Tables	✅
Models	✅
Constants	✅
Aggregate Boundaries	✅
Domain structure	✅
FIFO	✅
Return restoration	✅
Oldest-first	✅
Journal validation	✅
UnitOfWork concept	✅
Journal Repository	✅
Purchase Invoice Repository	✅
Inventory Repository	✅
Sales Invoice Repository	✅
Payment Voucher Repository	✅
Receipt Voucher Repository	✅
Sales Return Repository	⏳
Customer Refund Repository	⏳
Product Repository	⏳
Customer Repository	⏳
Supplier Repository	⏳
Category Repository	⏳
Unit Repository	⏳
Accounting Settings Repository	⏳
Accounting Period Repository	⏳
Application Services	⏳
WatermelonDB Repository Implementations	⏳
Transaction Infrastructure	⏳
Migration v1→v2	⏳
Integration Tests	⏳
Screen integration	⏳



---

العشرين: الحكم المعماري بعد المراجعة

لا أرى حالياً سبباً لإعادة بناء الـ Schema أو تغيير الـ Aggregate Architecture.

لكن عندي 4 نقاط حمراء يجب ألا نتجاوزها أثناء التنفيذ:

🔴 1. Transaction حقيقية

يجب ألا تسمح Implementations بأن تعمل كل Repository داخل database.write() منفصل.

🔴 2. Cache ليس Source of Truth

Allocation = Truth
paidAmount = Cache

BatchConsumption = Truth
costAtSale = Cache

🔴 3. Posting لا يعيش داخل Repository

Service = Business Process
Domain = Calculation/Rules
Repository = Persistence

🔴 4. الإلغاء لا يعني مجرد تغيير Flag

المستند المنشور الذي أثّر محاسبياً أو مخزنياً يحتاج Reverse Operation.


---

الخلاصة

الذي بنيناه حتى الآن ليس مجرد مجموعة Interfaces؛ أصبح لدينا نواة معمارية متماسكة:

┌──────────────────┐
                 │      Screens     │
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │ Application      │
                 │ Services         │
                 └────────┬─────────┘
                          ↓
              ┌───────────┴───────────┐
              ↓                       ↓
       ┌─────────────┐        ┌─────────────┐
       │   Domain    │        │ UnitOfWork  │
       │ Pure Rules  │        │ Transaction │
       └──────┬──────┘        └──────┬──────┘
              ↓                      ↓
       ┌────────────────────────────────────┐
       │          Repository Contracts      │
       └────────────────┬───────────────────┘
                        ↓
       ┌────────────────────────────────────┐
       │     WatermelonDB Infrastructure   │
       └────────────────┬───────────────────┘
                        ↓
                     SQLite

والقرار الذي أوصي بتثبيته الآن: لا ننتقل إلى WatermelonDB Implementations بعد. نكمل أولاً الـ Repository Contracts المتبقية، وبالتحديد SalesReturnRepository؛ لأنه أكثر Repository بعد المبيعات تعقيداً، وسيكشف لنا إن كانت الحدود الحالية للـ Aggregate والـ Inventory والـ CustomerRefund متماسكة قبل أن نثبتها في الكود الفعلي.