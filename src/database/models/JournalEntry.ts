import { Model, Query } from "@nozbe/watermelondb";
import {
  field,
  text,
  date,
  children,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import JournalEntryLine from "./JournalEntryLine";
import { JournalEntryStatus } from "@core/constants";

export default class JournalEntry extends Model {
  static table = "journal_entries";

  static associations: Associations = {
    journal_entry_lines: {
      type: "has_many" as const,
      foreignKey: "journal_entry_id",
    },
  };

  @date("entry_date")
  entryDate!: number;

  @text("reference_type")
  referenceType?: string | null;

  @text("reference_id")
  referenceId?: string | null;

  @text("description")
  description?: string | null;

  @text("status")
  status!: JournalEntryStatus;

  @text("created_by")
  createdBy!: string;

  @text("idempotency_key")
  idempotencyKey?: string | null;

  @field("is_reversed")
  isReversed!: boolean;
  @text("reversal_of_id")
  reversalOfId?: string | null;
  @date("reversed_at")
  reversedAt?: number | null;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;

  @children("journal_entry_lines")
  lines!: Query<JournalEntryLine>;
}
