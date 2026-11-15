import { Model, Relation } from "@nozbe/watermelondb";
import {
  field,
  text,
  date,
  relation,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import SalesReturn from "./SalesReturn";
import Customer from "./Customer";
import ChartOfAccount from "./ChartOfAccount";
import { DocumentStatus } from "@core/constants";

export default class CustomerRefund extends Model {
  static table = "customer_refunds";

  static associations: Associations = {
    sales_returns: {
      type: "belongs_to" as const,
      key: "sales_return_id",
    },

    customers: {
      type: "belongs_to" as const,
      key: "customer_id",
    },

    payment_accounts: {
      type: "belongs_to" as const,
      key: "payment_account_id",
    },
  };

  @relation("sales_returns", "sales_return_id")
  salesReturn!: Relation<SalesReturn>;

  @relation("customers", "customer_id")
  customer!: Relation<Customer>;

  @relation("payment_accounts", "payment_account_id")
  paymentAccount!: Relation<ChartOfAccount>;

  @date("refund_date")
  refundDate!: number;
  @text("refund_number")
  refundNumber?: string;
  @field("amount")
  amount!: number;

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

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
