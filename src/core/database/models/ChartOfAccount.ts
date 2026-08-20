/* eslint-disable @typescript-eslint/no-explicit-any */
import { Model } from "@nozbe/watermelondb";
import {
  text,
  field,
  date,
  readonly,
  children,
  immutableRelation,
  writer,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense"
  | "cogs";

export default class ChartOfAccount extends Model {
  static table = "chart_of_accounts";

  static associations: Associations = {
    chart_of_accounts: {
      type: "has_many",
      foreignKey: "parent_id",
    },
  };

  @text("code") code!: string;

  @text("name") name!: string;

  @text("type") type!: AccountType;

  @field("parent_id") parentId!: string | null;

  @field("is_cash_account") isCashAccount!: boolean;

  @field("is_active") isActive!: boolean;

  @readonly @date("created_at") createdAt!: Date;

  @readonly @date("updated_at") updatedAt!: Date;

  /**
   * الحساب الأب.
   *
   * parent_id يشير إلى سجل آخر من نفس جدول الحسابات.
   */
  @immutableRelation("chart_of_accounts", "parent_id")
  parentAccount!: ChartOfAccount;

  /**
   * الحسابات الفرعية.
   */
  @children("chart_of_accounts")
  childAccounts!: any;

  // ==========================================================
  // Computed properties
  // ==========================================================

  get isAsset(): boolean {
    return this.type === "asset";
  }

  get isLiability(): boolean {
    return this.type === "liability";
  }

  get isEquity(): boolean {
    return this.type === "equity";
  }

  get isRevenue(): boolean {
    return this.type === "revenue";
  }

  get isExpense(): boolean {
    return this.type === "expense";
  }

  get isCOGS(): boolean {
    return this.type === "cogs";
  }

  get isIncome(): boolean {
    return this.type === "revenue";
  }

  get isDebitNormal(): boolean {
    return (
      this.type === "asset" ||
      this.type === "expense" ||
      this.type === "cogs"
    );
  }

  get isCreditNormal(): boolean {
    return (
      this.type === "liability" ||
      this.type === "equity" ||
      this.type === "revenue"
    );
  }

  // ==========================================================
  // Writers
  // ==========================================================

  @writer async updateAccount(data: {
    code?: string;
    name?: string;
    type?: AccountType;
    parentId?: string | null;
    isCashAccount?: boolean;
  }) {
    await this.update((account: ChartOfAccount) => {
      if (data.code !== undefined) {
        account.code = data.code.trim();
      }

      if (data.name !== undefined) {
        account.name = data.name.trim();
      }

      if (data.type !== undefined) {
        account.type = data.type;
      }

      if (data.parentId !== undefined) {
        account.parentId = data.parentId || null;
      }

      if (data.isCashAccount !== undefined) {
        account.isCashAccount = data.isCashAccount;
      }
    });
  }

  @writer async deactivate() {
    await this.update((account: ChartOfAccount) => {
      account.isActive = false;
    });
  }

  @writer async activate() {
    await this.update((account: ChartOfAccount) => {
      account.isActive = true;
    });
  }
}