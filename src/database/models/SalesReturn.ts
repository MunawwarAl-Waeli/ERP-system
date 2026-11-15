import { Model, Relation, Query } from "@nozbe/watermelondb";
import {
  field,
  date,
  text,
  relation,
  children,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import SalesInvoice from "./SalesInvoice";
import Customer from "./Customer";
import SalesReturnItem from "./SalesReturnItem";
import CustomerRefund from "./CustomerRefund";
import { DocumentStatus } from "@core/constants";

export default class SalesReturn extends Model {
  static table = "sales_returns";

  static associations: Associations = {
    sales_invoices: {
      type: "belongs_to" as const,
      key: "sales_invoice_id",
    },

    customers: {
      type: "belongs_to" as const,
      key: "customer_id",
    },

    sales_return_items: {
      type: "has_many" as const,
      foreignKey: "sales_return_id",
    },

    customer_refunds: {
      type: "has_many" as const,
      foreignKey: "sales_return_id",
    },
  };

  @relation("sales_invoices", "sales_invoice_id")
  salesInvoice!: Relation<SalesInvoice>;

  @relation("customers", "customer_id")
  customer!: Relation<Customer>;


  @date("return_date")
  returnDate!: number;
  @text("return_number")
  returnNumber?: string;
  @field("total")
  total!: number;

  @text("status") status!: DocumentStatus;

  @text("created_by")
  createdBy!: string;

  @text("idempotency_key")
  idempotencyKey?: string;

  @field("is_cancelled")
  isCancelled!: boolean;

  @date("cancelled_at")
  cancelledAt?: number;

  @children("sales_return_items")
  items!: Query<SalesReturnItem>;

  @children("customer_refunds")
  customerRefunds!: Query<CustomerRefund>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
