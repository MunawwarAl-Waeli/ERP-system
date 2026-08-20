/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable curly */
import { Model } from "@nozbe/watermelondb";
import {
  text,
  field,
  date,
  readonly,
  children,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

export default class Customer extends Model {
  static table = "customers";

  static associations: Associations = {
    // علاقة بفواتير المبيعات
    sales_invoices: { type: "has_many", foreignKey: "customer_id" },
  };

  // الحقول الأساسية
  @text("name") name!: string;
  @text("phone") phone!: string;
  @text("address") address?: string;
  @text("notes") notes?: string;
  @field("is_active") isActive!: boolean;
  @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  // علاقة has_many مع الفواتير
  @children("sales_invoices") salesInvoices!: any;
}
