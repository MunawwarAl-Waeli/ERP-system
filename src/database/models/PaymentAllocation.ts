import { Model, Relation } from "@nozbe/watermelondb";
import {
  field,
  date,
  relation,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import PaymentVoucher from "./PaymentVoucher";
import PurchaseInvoice from "./PurchaseInvoice";

export default class PaymentAllocation extends Model {
  static table = "payment_allocations";

  static associations: Associations = {
    payment_vouchers: {
      type: "belongs_to" as const,
      key: "payment_voucher_id",
    },

    purchase_invoices: {
      type: "belongs_to" as const,
      key: "purchase_invoice_id",
    },
  };

  @relation("payment_vouchers", "payment_voucher_id")
  paymentVoucher!: Relation<PaymentVoucher>;

  @relation("purchase_invoices", "purchase_invoice_id")
  purchaseInvoice!: Relation<PurchaseInvoice>;

  @field("amount")
  amount!: number;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
