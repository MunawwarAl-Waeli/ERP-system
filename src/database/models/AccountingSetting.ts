import { Model, Relation } from "@nozbe/watermelondb";
import { date, readonly, relation, text } from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import ChartOfAccount from "./ChartOfAccount";

export default class AccountingSetting extends Model {
  static table = "accounting_settings";

  static associations: Associations = {
    customers_accounts: {
      type: "belongs_to" as const,
      key: "customers_account_id",
    },

    suppliers_accounts: {
      type: "belongs_to" as const,
      key: "suppliers_account_id",
    },

    cash_default_accounts: {
      type: "belongs_to" as const,
      key: "cash_default_account_id",
    },

    bank_default_accounts: {
      type: "belongs_to" as const,
      key: "bank_default_account_id",
    },

    income_summary_accounts: {
      type: "belongs_to" as const,
      key: "income_summary_account_id",
    },

    retained_earnings_accounts: {
      type: "belongs_to" as const,
      key: "retained_earnings_account_id",
    },
  };
  @text("customers_account_id")
  customersAccountId!: string;

  @text("suppliers_account_id")
  suppliersAccountId!: string;

  @text("cash_default_account_id")
  cashDefaultAccountId!: string;

  @text("bank_default_account_id")
  bankDefaultAccountId?: string | null;

  @text("income_summary_account_id")
  incomeSummaryAccountId?: string | null;

  @text("retained_earnings_account_id")
  retainedEarningsAccountId?: string | null;

  // ✅ الحسابات الافتراضية للمنتجات بدون تصنيف
  @text("inventory_default_account_id")
  inventoryDefaultAccountId?: string | null;

  @text("sales_default_account_id")
  salesDefaultAccountId?: string | null;

  @text("cogs_default_account_id")
  cogsDefaultAccountId?: string | null;

  @text("service_revenue_account_id")
  serviceRevenueAccountId?: string | null;

  @relation("customers_accounts", "customers_account_id")
  customersAccount!: Relation<ChartOfAccount>;

  @relation("suppliers_accounts", "suppliers_account_id")
  suppliersAccount!: Relation<ChartOfAccount>;

  @relation("cash_default_accounts", "cash_default_account_id")
  cashDefaultAccount!: Relation<ChartOfAccount>;

  @relation("bank_default_accounts", "bank_default_account_id")
  bankDefaultAccount!: Relation<ChartOfAccount>;

  @relation("income_summary_accounts", "income_summary_account_id")
  incomeSummaryAccount!: Relation<ChartOfAccount>;

  @relation("retained_earnings_accounts", "retained_earnings_account_id")
  retainedEarningsAccount!: Relation<ChartOfAccount>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}


