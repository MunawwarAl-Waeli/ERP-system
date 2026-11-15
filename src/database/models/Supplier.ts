import { Query } from "@nozbe/watermelondb";
import { children, date, field, readonly, text } from "@nozbe/watermelondb/decorators";
import Model, { Associations } from "@nozbe/watermelondb/Model";
import PurchaseInvoice from "./PurchaseInvoice";
import PaymentVoucher from "./PaymentVoucher";

export default class Supplier extends Model {
  static table = "suppliers";

  static associations: Associations = {
    purchase_invoices: {
      type: "has_many" as const,
      foreignKey: "supplier_id",
    },

    payment_vouchers: {
      type: "has_many" as const,
      foreignKey: "supplier_id",
    },
  };

  @text("name")
  name!: string;

  @text("phone")
  phone!: string | null;

  @text("address")
  address!: string | null;

  @field("is_active")
  isActive!: boolean;

  @children("purchase_invoices")
  purchaseInvoices!: Query<PurchaseInvoice>;

  @children("payment_vouchers")
  paymentVouchers!: Query<PaymentVoucher>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
