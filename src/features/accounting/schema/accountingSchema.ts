import { z } from "zod";

export const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "cogs",
] as const;

export const accountSchema = z.object({
  id: z.string().optional(),

  code: z
    .string()
    .trim()
    .min(1, "Account code is required")
    .max(20, "Account code is too long"),

  name: z
    .string()
    .trim()
    .min(2, "Account name is required")
    .max(100, "Account name is too long"),

  type: z.enum(ACCOUNT_TYPES),

  /**
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

  isCashAccount: z.boolean().default(false),
});

export type AccountFormData = z.infer<typeof accountSchema>;

export const accountingSettingsSchema = z.object({
  // Core accounting accounts
  inventoryAccountId: z.string().min(1),
  salesAccountId: z.string().min(1),
  cogsAccountId: z.string().min(1),
  customersAccountId: z.string().min(1),
  suppliersAccountId: z.string().min(1),

  // Default payment accounts
  cashDefaultAccountId: z.string().min(1),
  bankDefaultAccountId: z.string().optional().or(z.literal("")),

  // Additional accounting accounts
  serviceRevenueAccountId: z.string().optional().or(z.literal("")),

  incomeSummaryAccountId: z.string().optional().or(z.literal("")),

  retainedEarningsAccountId: z.string().optional().or(z.literal("")),
});

export type AccountingSettingsFormData = z.infer<
  typeof accountingSettingsSchema
>;
