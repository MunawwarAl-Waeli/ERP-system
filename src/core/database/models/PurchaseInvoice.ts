import { Model } from "@nozbe/watermelondb";
import {
  text,
  field,
  date,
  readonly,
  children,
  immutableRelation,
  writer,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

export type PurchasePaymentType = "cash" | "credit" | "partial";
export type PurchaseInvoiceStatus =
  | "draft"
  | "paid"
  | "partial"
  | "approved"
  | "cancelled";
const getInvoiceStatus = (
  paidAmount: number,
  totalAmount: number,
): PurchaseInvoiceStatus => {
  if (paidAmount >= totalAmount && totalAmount > 0) {
    return "paid";
  }
  if (paidAmount > 0) {
    return "partial";
  }
  return "approved";
};
export default class PurchaseInvoice extends Model {
  static table = "purchase_invoices";

  static associations: Associations = {
    suppliers: { type: "belongs_to" as const, key: "supplier_id" },
    purchase_invoice_items: {
      type: "has_many" as const,
      foreignKey: "purchase_invoice_id",
    },
  };

  @text("invoice_number") invoiceNumber?: string;
  @date("invoice_date") invoiceDate!: Date;
  @text("payment_type") paymentType!: PurchasePaymentType;
  @text("status") status!: PurchaseInvoiceStatus;
  @field("total") total!: number;
  @field("paid_amount") paidAmount!: number;
  @field("created_by") createdBy!: string;
  @field("supplier_id") supplierId?: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation("suppliers", "supplier_id") supplier: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @children("purchase_invoice_items") items: any;

  get remainingAmount(): number {
    return Math.max(0, this.total - this.paidAmount);
  }

  get isFullyPaid(): boolean {
    return this.paidAmount >= this.total && this.total > 0;
  }

  @writer async updateInvoice(data: {
    invoiceNumber?: string;
    invoiceDate?: Date;
    paymentType?: PurchasePaymentType;
    status?: PurchaseInvoiceStatus;
    total?: number;
    paidAmount?: number;
    supplierId?: string | null;
  }) {
    await this.update((invoice: PurchaseInvoice) => {
      if (data.invoiceNumber !== undefined) {
        invoice.invoiceNumber = data.invoiceNumber;
      }
      if (data.invoiceDate !== undefined) {
        invoice.invoiceDate = data.invoiceDate;
      }
      if (data.paymentType !== undefined) {
        invoice.paymentType = data.paymentType;
      }
      if (data.status !== undefined) {
        invoice.status = data.status;
      }
      if (data.total !== undefined) {
        invoice.total = data.total;
      }
      if (data.paidAmount !== undefined) {
        invoice.paidAmount = data.paidAmount;
      }
      if (data.supplierId !== undefined) {
        invoice.supplierId = data.supplierId;
      }
    });
  }

  @writer async updateStatus(newStatus: PurchaseInvoiceStatus) {
    await this.update((invoice: PurchaseInvoice) => {
      invoice.status = newStatus;
    });
  }

  @writer async recordPayment(amount: number) {
    await this.update((invoice: PurchaseInvoice) => {
      const currentPaid = invoice.paidAmount ?? 0;
      const newPaidAmount = currentPaid + amount;

      invoice.paidAmount = newPaidAmount;
      invoice.status = getInvoiceStatus(newPaidAmount, invoice.total);
    });
  }
}
