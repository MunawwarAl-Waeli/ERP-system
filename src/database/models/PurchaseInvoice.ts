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

import Supplier from "./Supplier";
import PurchaseInvoiceItem from "./PurchaseInvoiceItem";
import PaymentAllocation from "./PaymentAllocation";
import { PaymentType, DocumentStatus } from "@core/constants";

export type PurchaseInvoiceStatus = DocumentStatus;

export default class PurchaseInvoice extends Model {
  static table = "purchase_invoices";

  static associations: Associations = {
    suppliers: {
      type: "belongs_to" as const,
      key: "supplier_id",
    },

    purchase_invoice_items: {
      type: "has_many" as const,
      foreignKey: "purchase_invoice_id",
    },

    payment_allocations: {
      type: "has_many" as const,
      foreignKey: "purchase_invoice_id",
    },
  };

  @text("supplier_id")
  supplierId?: string;

  @relation("suppliers", "supplier_id")
  supplier!: Relation<Supplier>;

  @text("invoice_number")
  invoiceNumber?: string | null;

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
  idempotencyKey?: string | null;

  @field("is_cancelled")
  isCancelled!: boolean;

  @date("cancelled_at")
  cancelledAt?: number | null;

  @children("purchase_invoice_items")
  items!: Query<PurchaseInvoiceItem>;

  @children("payment_allocations")
  paymentAllocations!: Query<PaymentAllocation>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}

