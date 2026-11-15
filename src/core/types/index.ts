// وبعد PaymentVoucherRepository، الترتيب المنطقي الآن هو:
// ReceiptVoucherRepository — سندات القبض وتوزيع تحصيل العملاء.
// SalesReturnRepository — مرتجعات المبيعات + إعادة الكميات إلى الـ batches.
// CustomerRefundRepository — رد المبالغ للعميل عند وجود فائض مرتجع.
// ProductRepository — المنتجات والوحدات والحسابات المرتبطة بها.
// CustomerRepository
// SupplierRepository
// CategoryRepository
// UnitRepository
// AccountingSettingRepository
// AccountingPeriodRepository
// ثم مراجعة شاملة للـ Repository Contracts قبل الدخول في Implementations.
// بعدها الـ Application Services وربطها بـ UnitOfWork.
// ثم Implementations الخاصة بـ WatermelonDB
import type {StockMovementType } from "@core/constants";

// ── Store Profile ──
export interface StoreProfile {
  name: string;
  address: string;
  phone: string;
  gstNumber: string;
}

// ── Printer Config ──
export interface PrinterConfig {
  name: string;
  address: string;
  connected: boolean;
}

// ── Cart Item (billing session) ──
// core/types/index.ts
export interface CartItem {
  productId: string;
  productUnitId: string; // ✅ جديد (لدعم الوحدات)
  productName: string;
  unitName: string; // ✅ جديد (لعرض اسم الوحدة)
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number; // محسوب تلقائياً
  costAtSale?: number; // جديد (سيتم تحديثه بعد الترحيل)
}

// ── Date Range ──
export interface DateRange {
  from: Date;
  to: Date;
}

// ── Language ──
export interface Language {
  code: string;
  label: string;
  nativeLabel: string;
}

// ── Bluetooth Device ──
export interface BluetoothDevice {
  name: string;
  address: string;
}

// ── Report Types ──
export interface SalesReportData {
  totalSales: number;
  totalBills: number;
  averageBill: number;
  dailyBreakdown: DailySales[];
}

export interface DailySales {
  date: string;
  total: number;
  billCount: number;
}

export interface InventoryReportData {
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  products: ProductStockInfo[];
}

export interface ProductStockInfo {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  stockValue: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

export interface CreditReportData {
  totalOutstanding: number;
  customers: CustomerCreditInfo[];
}

export interface CustomerCreditInfo {
  id: string;
  name: string;
  phone: string;
  outstanding: number;
  lastTransactionDate: string;
}

export interface ProductPerformanceData {
  id: string;
  name: string;
  quantitySold: number;
  revenue: number;
}

// ── Bill Summary for display ──
export interface BillSummary {
  id: string;
  billNumber: string;
  customerName: string;
  grandTotal: number;
  paymentMode: PaymentMode;
  status: string;
  createdAt: Date;
}
////////////////////////////////
export type PaymentMode = "cash" | "credit" | "split";
export type SalesPaymentType = "cash" | "credit" | "partial";
export type SalesInvoiceType = "sale" | "sale_return";
export type IntegerMoney = number; // المبالغ تُخزن كأعداد صحيحة (مضروبة في 100 أو 1000)
export type Timestamp = number; // طابع زمني رقمي (Epoch Timestamp)

// ── 1. Base Command ──
export interface BaseCommand {
  createdBy: string;
  idempotencyKey: string; // إلزامي لمنع التكرار (Local-first)
}

// ── 2. Accounting Contracts ──
export interface JournalLineInput {
  accountId: string;
  debit: IntegerMoney;
  credit: IntegerMoney;
}

export interface CreateJournalEntryCommand extends BaseCommand {
  entryDate: Timestamp;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  lines: JournalLineInput[];
}

// ── 3. Inventory & FIFO Contracts ──
export interface ConsumedBatchAllocation {
  batchId: string;
  quantityConsumed: number;
  unitCost: IntegerMoney;
}

export interface FIFOAllocationResult {
  productId: string;
  totalQuantity: number;
  totalCogs: IntegerMoney;
  allocations: ConsumedBatchAllocation[];
}

export interface StockMovementCommandInput extends BaseCommand {
  productId: string;
  productUnitId: string;
  batchId?: string;
  quantity: number; // موجبة للدخول، سالبة للخروج
  movementType: StockMovementType; // استخدام النوع الذي عرفته أنت بدقة
  referenceType?: string;
  referenceId?: string;
  unitCost: IntegerMoney;
  movementDate: Timestamp;
}

// ── 4. Purchase Contracts ──
export interface PurchaseInvoiceItemInput {
  productId: string;
  productUnitId: string;
  quantity: number;
  unitCost: IntegerMoney;
}

export interface CreatePurchaseInvoiceCommand extends BaseCommand {
  supplierId: string;
  invoiceNumber?: string;
  invoiceDate: Timestamp;
  paymentType: SalesPaymentType; // استخدام نوع الدفع المعرف لديك
  items: PurchaseInvoiceItemInput[];
  paidAmount?: IntegerMoney;
}

export interface PostPurchaseCommand extends BaseCommand {
  purchaseInvoiceId: string;
}

// ── 5. Sales Contracts ──
export interface SalesInvoiceItemInput {
  itemType: "product" | "service";
  productId?: string;
  productUnitId?: string;
  description?: string;
  quantity: number;
  unitPrice: IntegerMoney;
}

export interface CreateSalesInvoiceCommand extends BaseCommand {
  customerId: string;
  invoiceNumber?: string;
  invoiceDate: Timestamp;
  paymentType: SalesPaymentType; // استخدام نوع السداد المعرف لديك
  invoiceType: SalesInvoiceType; // استخدام نوع الفاتورة المعرف لديك (sale | sale_return)
  items: SalesInvoiceItemInput[];
  paidAmount?: IntegerMoney;
}

export interface PostSalesInvoiceCommand extends BaseCommand {
  salesInvoiceId: string;
}

// ── 6. Vouchers & Allocations Contracts ──
export interface PaymentAllocationInput {
  allocatableType: "sales_invoices" | "purchase_invoices";
  allocatableId: string;
  amount: IntegerMoney;
}

export interface CreateReceiptVoucherCommand extends BaseCommand {
  voucherNumber: string;
  voucherDate: Timestamp;
  paymentAccountId: string;
  customerId: string;
  amount: IntegerMoney;
  paymentMode: PaymentMode; // استخدام نمط الدفع المعرف لديك (CASH, UPI, CARD...)
  description?: string;
  allocations?: PaymentAllocationInput[];
}

export interface CreatePaymentVoucherCommand extends BaseCommand {
  voucherNumber: string;
  voucherDate: Timestamp;
  paymentAccountId: string;
  supplierId: string;
  amount: IntegerMoney;
  paymentMode: PaymentMode;
  description?: string;
  allocations?: PaymentAllocationInput[];
}
