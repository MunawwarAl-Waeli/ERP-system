import { Model, Relation, Query } from "@nozbe/watermelondb";
import {
  field,
  date,
  relation,
  children,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import SalesInvoice from "./SalesInvoice";
import Product from "./Product";
import ProductUnit from "./ProductUnit";
import SaleItemBatchConsumption from "./SaleItemBatchConsumption";

export default class SalesInvoiceItem extends Model {
  static table = "sales_invoice_items";

  static associations: Associations = {
    sales_invoices: {
      type: "belongs_to" as const,
      key: "sales_invoice_id",
    },

    products: {
      type: "belongs_to" as const,
      key: "product_id",
    },

    product_units: {
      type: "belongs_to" as const,
      key: "product_unit_id",
    },

    sale_item_batch_consumptions: {
      type: "has_many" as const,
      foreignKey: "sales_invoice_item_id",
    },
  };

  @relation("sales_invoices", "sales_invoice_id")
  salesInvoice!: Relation<SalesInvoice>;

  @relation("products", "product_id")
  product!: Relation<Product>;

  @relation("product_units", "product_unit_id")
  productUnit!: Relation<ProductUnit>;

  @field("quantity")
  quantity!: number;
  @field("base_quantity")
  baseQuantity!: number;
  @field("unit_price")
  unitPrice!: number;

  @field("cost_at_sale")
  costAtSale!: number;

  @field("total")
  total!: number;

  @children("sale_item_batch_consumptions")
  batchConsumptions!: Query<SaleItemBatchConsumption>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
