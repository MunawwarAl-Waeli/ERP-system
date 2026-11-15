import { Model, Query, Relation } from "@nozbe/watermelondb";
import {
  field,
  text,
  date,
  relation,
  children,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import JournalEntryLine from "./JournalEntryLine";
import { AccountType } from "@core/constants";
export type { AccountType };

export default class ChartOfAccount extends Model {
  static table = "chart_of_accounts";

  static associations: Associations = {
    journal_entry_lines: {
      type: "has_many" as const,
      foreignKey: "account_id",
    },

    parent_account: {
      type: "belongs_to" as const,
      key: "parent_id",
    },

    child_accounts: {
      type: "has_many" as const,
      foreignKey: "parent_id",
    },
  };

  @text("code")
  code!: string;

  @text("name")
  name!: string;

  @text("type")
  type!: AccountType;

  @text("parent_id")
  parentId?: string | null;

  @field("allow_posting")
  allowPosting!: boolean;

  @field("is_cash_account")
  isCashAccount!: boolean;

  @field("is_active")
  isActive!: boolean;

  @relation("parent_account", "parent_id")
  parentAccount!: Relation<ChartOfAccount>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;

  @children("journal_entry_lines")
  entryLines!: Query<JournalEntryLine>;

  @children("child_accounts")
  childAccounts!: Query<ChartOfAccount>;
}