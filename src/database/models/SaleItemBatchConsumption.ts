import { Model, Relation } from "@nozbe/watermelondb";
import {
  field,
  date,
  relation,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import SalesInvoiceItem from "./SalesInvoiceItem";
import ProductBatch from "./ProductBatch";

export default class SaleItemBatchConsumption extends Model {
  static table = "sale_item_batch_consumptions";

  static associations: Associations = {
    sales_invoice_items: {
      type: "belongs_to" as const,
      key: "sales_invoice_item_id",
    },

    product_batches: {
      type: "belongs_to" as const,
      key: "batch_id",
    },
  };

  @relation("sales_invoice_items", "sales_invoice_item_id")
  salesInvoiceItem!: Relation<SalesInvoiceItem>;

  @relation("product_batches", "batch_id")
  productBatch!: Relation<ProductBatch>;

  @field("quantity")
  quantity!: number;

  @field("unit_cost")
  unitCost!: number;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
