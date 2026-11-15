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

import Customer from "./Customer";
import SalesInvoiceItem from "./SalesInvoiceItem";
import ReceiptAllocation from "./ReceiptAllocation";
import SalesReturn from "./SalesReturn";
import { PaymentType, DocumentStatus } from "@core/constants";

export default class SalesInvoice extends Model {
  static table = "sales_invoices";

  static associations: Associations = {
    customers: {
      type: "belongs_to" as const,
      key: "customer_id",
    },

    sales_invoice_items: {
      type: "has_many" as const,
      foreignKey: "sales_invoice_id",
    },

    receipt_allocations: {
      type: "has_many" as const,
      foreignKey: "sales_invoice_id",
    },

    sales_returns: {
      type: "has_many" as const,
      foreignKey: "sales_invoice_id",
    },
  };

  @relation("customers", "customer_id")
  customer!: Relation<Customer>;

  @text("invoice_number")
  invoiceNumber?: string|null;

  @date("invoice_date")
  invoiceDate!: number;

  @text("payment_type")
  paymentType!: PaymentType;

  @text("status")
  status!: DocumentStatus;

  @field("total")
  total!: number;

  @field("paid_amount")
  paidAmount!: number;

  @text("created_by")
  createdBy!: string;

  @text("idempotency_key")
  idempotencyKey?: string|null;

  @field("is_cancelled")
  isCancelled!: boolean;

  @date("cancelled_at")
  cancelledAt?: number|null;

  @children("sales_invoice_items")
  items!: Query<SalesInvoiceItem>;

  @children("receipt_allocations")
  receiptAllocations!: Query<ReceiptAllocation>;

  @children("sales_returns")
  salesReturns!: Query<SalesReturn>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
