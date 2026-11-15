import { Model, Relation } from "@nozbe/watermelondb";
import {
  field,
  date,
  text,
  relation,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import JournalEntry from "./JournalEntry";
import ChartOfAccount from "./ChartOfAccount";

export default class JournalEntryLine extends Model {
  static table = "journal_entry_lines";

  static associations: Associations = {
    journal_entries: {
      type: "belongs_to" as const,
      key: "journal_entry_id",
    },

    accounts: {
      type: "belongs_to" as const,
      key: "account_id",
    },
  };
  @text("account_id")
  accountId!: string;
  @relation("journal_entries", "journal_entry_id")
  journalEntry!: Relation<JournalEntry>;

  @relation("accounts", "account_id")
  account!: Relation<ChartOfAccount>;

  @field("debit")
  debit!: number;
  @field("line_order")
  lineOrder!: number;
  @field("credit")
  credit!: number;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
