import { z } from "zod";

/**
 * أنواع الحسابات الأساسية في النظام المحاسبي.
 *
 * ملاحظة:
 * تكلفة المبيعات COGS تعتبر حساب مصروف
 * وليست نوع حساب مستقل.
 */
export const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
] as const;

export const accountSchema = z.object({
  /**
   * معرف الحساب.
   * غير موجود عند إنشاء حساب جديد.
   */
  id: z.string().optional(),

  /**
   * رقم الحساب المحاسبي.
   * مثال:
   * 1110
   * 1120
   * 1200
   */
  code: z
    .string()
    .trim()
    .min(1, "Account code is required")
    .max(20, "Account code is too long"),

  /**
   * اسم الحساب.
   */
  name: z
    .string()
    .trim()
    .min(2, "Account name is required")
    .max(100, "Account name is too long"),

  /**
   * نوع الحساب.
   */
  type: z.enum(ACCOUNT_TYPES),

  /**
   * الحساب الأب.
   *
   * null = حساب رئيسي
   * string = حساب فرعي
   */
  parentId: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform((value) => value || null),

  /**
   * هل يسمح النظام بترحيل قيود مباشرة على الحساب؟
   *
   * false = حساب تجميعي / رئيسي
   * true  = حساب قابل للقيد
   */
  allowPosting: z.boolean().default(false),

  /**
   * هل الحساب مرتبط بالصندوق؟
   */
  isCashAccount: z.boolean().default(false),

  /**
   * حالة الحساب.
   *
   * ملاحظة:
   * هذا الحقل موجود في قاعدة البيانات،
   * ويمكن أن يكون افتراضيًا true عند الإنشاء.
   */
  isActive: z.boolean().default(true),
});

export type AccountFormData = z.infer<typeof accountSchema>;

/**
 * إعدادات الحسابات الافتراضية للنظام.
 *
 * هذه ليست شجرة الحسابات نفسها.
 * وإنما تحدد أي حساب يستخدمه النظام تلقائيًا
 * عند تنفيذ العمليات المحاسبية.
 */
export const accountingSettingsSchema = z.object({
  // =========================
  // الحسابات الأساسية
  // =========================

  /**
   * المخزون
   * يجب أن يكون حساب Asset.
   */
  inventoryAccountId: z.string().min(1),

  /**
   * المبيعات
   * يجب أن يكون حساب Revenue.
   */
  salesAccountId: z.string().min(1),

  /**
   * تكلفة المبيعات
   * يجب أن يكون حساب Expense.
   */
  cogsAccountId: z.string().min(1),

  /**
   * العملاء
   * يجب أن يكون حساب Asset.
   */
  customersAccountId: z.string().min(1),

  /**
   * الموردون
   * يجب أن يكون حساب Liability.
   */
  suppliersAccountId: z.string().min(1),

  // =========================
  // حسابات النقدية
  // =========================

  /**
   * حساب الصندوق الافتراضي.
   */
  cashDefaultAccountId: z.string().min(1),

  /**
   * حساب البنك الافتراضي.
   *
   * null = لا يوجد حساب بنك افتراضي.
   */
  bankDefaultAccountId: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform((value) => value || null),

  // =========================
  // حسابات إضافية
  // =========================

  /**
   * إيرادات الخدمات.
   */
  serviceRevenueAccountId: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform((value) => value || null),

  /**
   * حساب ملخص الدخل.
   */
  incomeSummaryAccountId: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform((value) => value || null),

  /**
   * الأرباح المحتجزة / الأرباح المرحلة.
   */
  retainedEarningsAccountId: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform((value) => value || null),
});

export type AccountingSettingsFormData = z.infer<
  typeof accountingSettingsSchema
>;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export function validateAccountType(type: string): asserts type is AccountType {
  if (!ACCOUNT_TYPES.includes(type as AccountType)) {
    throw new Error(`نوع الحساب غير صالح: ${type}`);
  }
}
