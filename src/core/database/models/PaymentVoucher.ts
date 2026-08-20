import { Model } from "@nozbe/watermelondb";
import { text, field, date, readonly } from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

export default class PaymentVoucher extends Model {
  static table = "payment_vouchers";

  static associations: Associations = {
    chart_of_accounts: {
      type: "belongs_to" as const,
      key: "payment_account_id",
    },
  };

  @text("voucher_number")
  voucherNumber!: string;

  @date("voucher_date")
  voucherDate!: Date;

  @field("payment_account_id")
  paymentAccountId!: string;

  @field("amount")
  amount!: number;

  @text("description")
  description?: string | null;

  @text("reference_type")
  referenceType?: string | null;

  @field("reference_id")
  referenceId?: string | null;

  @text("status")
  status!: "draft" | "posted" | "cancelled";

  @field("created_by")
  createdBy!: string;

  @readonly
  @date("created_at")
  createdAt!: Date;

  @readonly
  @date("updated_at")
  updatedAt!: Date;
}
