import { Model, Relation, Query } from "@nozbe/watermelondb";
import {
  field,
  date,
  relation,
  children,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import PurchaseInvoice from "./PurchaseInvoice";
import Product from "./Product";
import ProductUnit from "./ProductUnit";
import ProductBatch from "./ProductBatch";

export default class PurchaseInvoiceItem extends Model {
  static table = "purchase_invoice_items";

  static associations: Associations = {
    purchase_invoices: {
      type: "belongs_to" as const,
      key: "purchase_invoice_id",
    },

    products: {
      type: "belongs_to" as const,
      key: "product_id",
    },

    product_units: {
      type: "belongs_to" as const,
      key: "product_unit_id",
    },

    product_batches: {
      type: "has_many" as const,
      foreignKey: "purchase_item_id",
    },
  };

  @relation("purchase_invoices", "purchase_invoice_id")
  purchaseInvoice!: Relation<PurchaseInvoice>;

  @relation("products", "product_id")
  product!: Relation<Product>;

  @relation("product_units", "product_unit_id")
  productUnit!: Relation<ProductUnit>;

  @field("quantity")
  quantity!: number;

  @field("unit_cost")
  unitCost!: number;

  @field("total")
  total!: number;

  @children("product_batches")
  batches!: Query<ProductBatch>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
