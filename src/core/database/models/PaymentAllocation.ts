import { Model } from "@nozbe/watermelondb";
import {
  text,
  field,
  date,
  readonly,
  immutableRelation,
  writer,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

export default class PaymentAllocation extends Model {
  static table = "payment_allocations";

  static associations: Associations = {
    payment_vouchers: {
      type: "belongs_to" as const,
      key: "payment_voucher_id",
    },
    receipt_vouchers: {
      type: "belongs_to" as const,
      key: "receipt_voucher_id",
    },
  };

  @field("payment_voucher_id") paymentVoucherId?: string | null;
  @field("receipt_voucher_id") receiptVoucherId?: string | null;
  @text("allocatable_type") allocatableType!: string;
  @text("allocatable_id") allocatableId!: string;
  @field("amount") amount!: number;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation("payment_vouchers", "payment_voucher_id")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paymentVoucher: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation("receipt_vouchers", "receipt_voucher_id")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  receiptVoucher: any;

  @writer async updateAllocation(data: {
    amount?: number;
    paymentVoucherId?: string | null;
    receiptVoucherId?: string | null;
  }) {
    await this.update((allocation: PaymentAllocation) => {
      if (data.amount !== undefined) {
        allocation.amount = data.amount;
      }
      if (data.paymentVoucherId !== undefined) {
        allocation.paymentVoucherId = data.paymentVoucherId;
      }
      if (data.receiptVoucherId !== undefined) {
        allocation.receiptVoucherId = data.receiptVoucherId;
      }
    });
  }
}
