import { Model } from "@nozbe/watermelondb";
import { field, date, readonly, text } from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

export default class Expense extends Model {
  static table = "expenses";
  static associations: Associations = {};

  @text("expense_account_id")
  expenseAccountId!: string;

  @text("payment_account_id")
  paymentAccountId!: string;

  @field("amount")
  amount!: number;

  @text("description")
  description!: string;

  @text("reference_number")
  referenceNumber?: string | null;

  @date("expense_date")
  expenseDate!: number;

  @text("created_by")
  createdBy!: string;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
