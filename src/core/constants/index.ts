// ============================================================
// Application Constants
// المصدر المركزي للثوابت والقيم المسموح بها في التطبيق
// ============================================================

// ─────────────────────────────────────────────────────────────
// Account Types
// ─────────────────────────────────────────────────────────────

export const ACCOUNT_TYPES = {
  ASSET: "asset",
  LIABILITY: "liability",
  EQUITY: "equity",
  REVENUE: "revenue",
  EXPENSE: "expense",
  COGS: "cogs",
} as const;

export type AccountType = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES];

// ─────────────────────────────────────────────────────────────
// Payment Types
// تستخدم في فواتير البيع والشراء
// ─────────────────────────────────────────────────────────────

export const PAYMENT_TYPES = {
  CASH: "cash",
  CREDIT: "credit",
  PARTIAL: "partial",
} as const;

export type PaymentType = (typeof PAYMENT_TYPES)[keyof typeof PAYMENT_TYPES];

// ─────────────────────────────────────────────────────────────
// Document Statuses
// ─────────────────────────────────────────────────────────────

export const DOCUMENT_STATUSES = {
  DRAFT: "draft",
  POSTED: "posted",
  CANCELLED: "cancelled",
} as const;

export type DocumentStatus =
  (typeof DOCUMENT_STATUSES)[keyof typeof DOCUMENT_STATUSES];

// أسماء حالات الفواتير للتوافق مع شاشات لوحة التحكم والتقارير القديمة
export const BILL_STATUSES = {
  DRAFT: "draft",
  POSTED: "posted",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  APPROVED: "approved",
} as const;

export type BillStatus = (typeof BILL_STATUSES)[keyof typeof BILL_STATUSES];

// ─────────────────────────────────────────────────────────────
// Journal Entry Statuses
// ─────────────────────────────────────────────────────────────

export const JOURNAL_ENTRY_STATUSES = {
  DRAFT: "draft",
  POSTED: "posted",
  REVERSED: "reversed",
} as const;

export type JournalEntryStatus =
  (typeof JOURNAL_ENTRY_STATUSES)[keyof typeof JOURNAL_ENTRY_STATUSES];

// ─────────────────────────────────────────────────────────────
// Stock Movement Types
// الكمية الداخلية دائمًا بالقطعة (base unit)
// ─────────────────────────────────────────────────────────────

export const STOCK_MOVEMENT_TYPES = {
  PURCHASE_IN: "purchase_in",
  SALE_OUT: "sale_out",
  SALE_RETURN: "sale_return",
  ADJUSTMENT_IN: "adjustment_in",
  ADJUSTMENT_OUT: "adjustment_out",
} as const;

export type StockMovementType =
  (typeof STOCK_MOVEMENT_TYPES)[keyof typeof STOCK_MOVEMENT_TYPES];

// ─────────────────────────────────────────────────────────────
// Journal / Document Reference Types
// تستخدم للربط المرجعي مع القيود والحركات
// ─────────────────────────────────────────────────────────────

export const REFERENCE_TYPES = {
  PURCHASE_INVOICE: "purchase_invoice",
  SALES_INVOICE: "sales_invoice",
  RECEIPT_VOUCHER: "receipt_voucher",
  PAYMENT_VOUCHER: "payment_voucher",
  SALES_RETURN: "sales_return",
  CUSTOMER_REFUND: "customer_refund",
  STOCK_ADJUSTMENT: "stock_adjustment",
  EXPENSE: "expense",
} as const;

export type ReferenceType =
  (typeof REFERENCE_TYPES)[keyof typeof REFERENCE_TYPES];

// ─────────────────────────────────────────────────────────────
// Units
// الوحدات الأساسية المقترحة في النظام
// ملاحظة: الوحدات الفعلية مخزنة في جدول units
// ─────────────────────────────────────────────────────────────

export const UNIT_CODES = {
  PIECE: "piece",
  KG: "kg",
  LITRE: "litre",
  PACKET: "packet",
  DOZEN: "dozen",
  CARTON: "carton",
  BAG: "bag",
} as const;

export type UnitCode = (typeof UNIT_CODES)[keyof typeof UNIT_CODES];

// ─────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────

export const THEME_MODES = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
} as const;

export type ThemeMode = (typeof THEME_MODES)[keyof typeof THEME_MODES];

// ─────────────────────────────────────────────────────────────
// Languages
// ─────────────────────────────────────────────────────────────

export const LANGUAGES = [
  {
    code: "ar",
    label: "Arabic",
    nativeLabel: "العربية",
  },
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
  },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

// ─────────────────────────────────────────────────────────────
// Application Defaults
// ─────────────────────────────────────────────────────────────

export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

export const PIN_LENGTH = 4;

export const BILL_NUMBER_PREFIX = "KM";

export const DATE_FORMAT = "DD/MM/YYYY";

export const DATE_TIME_FORMAT = "DD/MM/YYYY hh:mm A";

export const CURRENCY_SYMBOL = "ر.ي";

export const APP_VERSION = "1.0.0";

// ─────────────────────────────────────────────────────────────
// Accounting
// ─────────────────────────────────────────────────────────────

export const ACCOUNTING = {
  BASE_UNIT: UNIT_CODES.PIECE,

  // القيم المالية المخزنة كأعداد صحيحة
  // حسب سياسة النظام الحالية
  MONEY_SCALE: 1000,

  // لا يسمح بزيادة رصيد العميل/المورد عن طريق الدفع
  ALLOW_OVERPAYMENT: false,

  // السلف مؤجلة إلى الإصدار الثاني
  ALLOW_ADVANCES: false,
} as const;

// ─────────────────────────────────────────────────────────────
// Invoice Numbering
// ─────────────────────────────────────────────────────────────

export const DOCUMENT_PREFIXES = {
  SALES_INVOICE: "SI",
  PURCHASE_INVOICE: "PI",
  RECEIPT_VOUCHER: "RV",
  PAYMENT_VOUCHER: "PV",
  SALES_RETURN: "SR",
  CUSTOMER_REFUND: "CR",
} as const;

export type DocumentPrefix =
  (typeof DOCUMENT_PREFIXES)[keyof typeof DOCUMENT_PREFIXES];

// ─────────────────────────────────────────────────────────────
// Sales Return
// سياسة إعادة المخزون
// ─────────────────────────────────────────────────────────────

export const SALES_RETURN_POLICIES = {
  // إعادة آخر Batch تم استهلاكه أولًا
  BATCH_RESTORATION: "last_consumed_first",
} as const;

export type SalesReturnBatchRestorationPolicy =
  (typeof SALES_RETURN_POLICIES)[keyof typeof SALES_RETURN_POLICIES];

// ─────────────────────────────────────────────────────────────
// FIFO
// ─────────────────────────────────────────────────────────────

export const INVENTORY_COSTING = {
  METHOD: "fifo",

  // ترتيب الـ batches حسب received_date
  BATCH_ORDER_FIELD: "received_date",

  // الوحدة الداخلية للمخزون
  BASE_UNIT: UNIT_CODES.PIECE,
} as const;

// ─────────────────────────────────────────────────────────────
// Payment Allocation
// ─────────────────────────────────────────────────────────────

export const PAYMENT_ALLOCATION = {
  // تسوية أقدم فاتورة مستحقة أولًا
  METHOD: "oldest_first",

  ALLOW_OVERPAYMENT: false,
} as const;

// ─────────────────────────────────────────────────────────────
// Entity Status
// ─────────────────────────────────────────────────────────────

export const ACTIVE_STATUS = {
  ACTIVE: true,
  INACTIVE: false,
} as const;

// ─────────────────────────────────────────────────────────────
// Payment Allocatable Types
// ─────────────────────────────────────────────────────────────

export const ALLOCATABLE_TYPES = {
  PURCHASE_INVOICE: "purchase_invoice",
  SALES_INVOICE: "sales_invoice",
} as const;

export type AllocatableType =
  (typeof ALLOCATABLE_TYPES)[keyof typeof ALLOCATABLE_TYPES];

// ─────────────────────────────────────────────────────────────
// Stock Reasons
// ─────────────────────────────────────────────────────────────

export const STOCK_REASONS = {
  PURCHASE: "purchase",
  DAMAGE: "damage",
  EXPIRED: "expired",
  THEFT: "theft",
  COUNT: "count",
  CORRECTION: "correction",
  OTHER: "other",
} as const;

export type StockReason = (typeof STOCK_REASONS)[keyof typeof STOCK_REASONS];
