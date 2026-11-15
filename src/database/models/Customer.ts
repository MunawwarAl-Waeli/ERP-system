import { Model, Query } from "@nozbe/watermelondb";
import {
  text,
  field,
  date,
  children,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import SalesInvoice from "./SalesInvoice";
import ReceiptVoucher from "./ReceiptVoucher";
import SalesReturn from "./SalesReturn";
import CustomerRefund from "./CustomerRefund";

export default class Customer extends Model {
  static table = "customers";

  static associations: Associations = {
    sales_invoices: {
      type: "has_many" as const,
      foreignKey: "customer_id",
    },

    receipt_vouchers: {
      type: "has_many" as const,
      foreignKey: "customer_id",
    },

    sales_returns: {
      type: "has_many" as const,
      foreignKey: "customer_id",
    },

    customer_refunds: {
      type: "has_many" as const,
      foreignKey: "customer_id",
    },
  };

  @text("name")
  name!: string;

  @text("phone")
  phone!: string;

  @text("address")
  address?: string;

  @text("notes")
  notes?: string;

  @field("is_active")
  isActive!: boolean;

  @children("sales_invoices")
  salesInvoices!: Query<SalesInvoice>;

  @children("receipt_vouchers")
  receiptVouchers!: Query<ReceiptVoucher>;

  @children("sales_returns")
  salesReturns!: Query<SalesReturn>;

  @children("customer_refunds")
  customerRefunds!: Query<CustomerRefund>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
