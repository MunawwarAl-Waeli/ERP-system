import { Model, Relation } from "@nozbe/watermelondb";
import {
  field,
  date,
  relation,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import ReceiptVoucher from "./ReceiptVoucher";
import SalesInvoice from "./SalesInvoice";

export default class ReceiptAllocation extends Model {
  static table = "receipt_allocations";

  static associations: Associations = {
    receipt_vouchers: {
      type: "belongs_to" as const,
      key: "receipt_voucher_id",
    },

    sales_invoices: {
      type: "belongs_to" as const,
      key: "sales_invoice_id",
    },
  };

  @relation("receipt_vouchers", "receipt_voucher_id")
  receiptVoucher!: Relation<ReceiptVoucher>;

  @relation("sales_invoices", "sales_invoice_id")
  salesInvoice!: Relation<SalesInvoice>;

  @field("amount")
  amount!: number;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
