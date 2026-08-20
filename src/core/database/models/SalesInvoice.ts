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

export type SalesInvoiceType = "sale" | "sale_return";
export type SalesPaymentType = "cash" | "credit" | "partial";
export type SalesInvoiceStatus =
  | "draft"
  | "approved"
  | "cancelled"
  | "paid"
  | "partial";

/**
 * دالة مساعدة لتحديد حالة الفاتورة للعرض (استرجاع مبكر لتجنب أخطاء ESLint)
 */
const getInvoiceStatus = (
  paidAmount: number,
  totalAmount: number,
): SalesInvoiceStatus => {
  if (paidAmount >= totalAmount && totalAmount > 0) {
    return "paid";
  }
  if (paidAmount > 0) {
    return "partial";
  }
  return "approved";
};

export default class SalesInvoice extends Model {
  static table = "sales_invoices";

  static associations: Associations = {
    customers: { type: "belongs_to" as const, key: "customer_id" },
    sales_invoice_items: {
      type: "has_many" as const,
      foreignKey: "sales_invoice_id",
    },
  };

  @field("customer_id") customerId?: string | null;
  @text("invoice_number") invoiceNumber?: string;
  @text("invoice_type") invoiceType!: SalesInvoiceType;
  @date("invoice_date") invoiceDate!: Date;
  @text("payment_type") paymentType!: SalesPaymentType;
  @text("status") status!: SalesInvoiceStatus;
  @field("total") total!: number;
  @field("paid_amount") paidAmount?: number;
  @field("created_by") createdBy!: string;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation("customers", "customer_id") customer: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @children("sales_invoice_items") items: any;

  /**
   * المتبقي العرضي على الفاتورة (آمن ضد القيم الفارغة)
   */
  get remainingAmount(): number {
    const paid = this.paidAmount ?? 0;
    return Math.max(0, this.total - paid);
  }

  get isFullyPaid(): boolean {
    const paid = this.paidAmount ?? 0;
    return paid >= this.total && this.total > 0;
  }

  get isReturn(): boolean {
    return this.invoiceType === "sale_return";
  }

  @writer async updateInvoice(data: {
    customerId?: string | null;
    invoiceType?: SalesInvoiceType;
    invoiceDate?: Date;
    paymentType?: SalesPaymentType;
    status?: SalesInvoiceStatus;
    total?: number;
    paidAmount?: number;
  }) {
    await this.update((invoice: SalesInvoice) => {
      if (data.customerId !== undefined) {
        invoice.customerId = data.customerId;
      }
      if (data.invoiceType !== undefined) {
        invoice.invoiceType = data.invoiceType;
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
    });
  }

  /**
   * تحديث مؤشر المبلغ المدفوع والحالة عند السداد التلقائي من سند القبض
   */
  @writer async recordPayment(amount: number) {
    await this.update((invoice: SalesInvoice) => {
      const currentPaid = invoice.paidAmount ?? 0;
      const newPaidAmount = currentPaid + amount;

      invoice.paidAmount = newPaidAmount;
      invoice.status = getInvoiceStatus(newPaidAmount, invoice.total);
    });
  }
}
