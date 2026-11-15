import { Model, Relation, Query } from "@nozbe/watermelondb";
import {
  field,
  text,
  date,
  relation,
  children,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import ChartOfAccount from "./ChartOfAccount";
import Supplier from "./Supplier";
import PaymentAllocation from "./PaymentAllocation";
import { DocumentStatus } from "@core/constants";

export default class PaymentVoucher extends Model {
  static table = "payment_vouchers";

  static associations: Associations = {
    payment_accounts: {
      type: "belongs_to" as const,
      key: "payment_account_id",
    },

    suppliers: {
      type: "belongs_to" as const,
      key: "supplier_id",
    },

    payment_allocations: {
      type: "has_many" as const,
      foreignKey: "payment_voucher_id",
    },
  };

  @text("voucher_number")
  voucherNumber!: string;

  @date("voucher_date")
  voucherDate!: number;

  @relation("payment_accounts", "payment_account_id")
  paymentAccount!: Relation<ChartOfAccount>;

  @relation("suppliers", "supplier_id")
  supplier!: Relation<Supplier>;

  @field("amount")
  amount!: number;

  @text("description")
  description?: string;

  @text("status")
  status!: DocumentStatus;

  @text("created_by")
  createdBy!: string;

  @text("idempotency_key")
  idempotencyKey?: string;

  @field("is_cancelled")
  isCancelled!: boolean;

  @date("cancelled_at")
  cancelledAt?: number;

  @children("payment_allocations")
  allocations!: Query<PaymentAllocation>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
