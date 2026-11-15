import { Model, Relation, Query } from "@nozbe/watermelondb";
import {
  field,
  date,
  relation,
  children,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import SalesReturn from "./SalesReturn";
import SalesInvoiceItem from "./SalesInvoiceItem";
import Product from "./Product";
import ProductUnit from "./ProductUnit";
import SalesReturnBatchAllocation from "./SalesReturnBatchAllocation";

export default class SalesReturnItem extends Model {
  static table = "sales_return_items";

  static associations: Associations = {
    sales_returns: {
      type: "belongs_to" as const,
      key: "sales_return_id",
    },

    sales_invoice_items: {
      type: "belongs_to" as const,
      key: "sales_invoice_item_id",
    },

    products: {
      type: "belongs_to" as const,
      key: "product_id",
    },

    product_units: {
      type: "belongs_to" as const,
      key: "product_unit_id",
    },

    sales_return_batch_allocations: {
      type: "has_many" as const,
      foreignKey: "sales_return_item_id",
    },
  };

  @relation("sales_returns", "sales_return_id")
  salesReturn!: Relation<SalesReturn>;

  @relation("sales_invoice_items", "sales_invoice_item_id")
  salesInvoiceItem!: Relation<SalesInvoiceItem>;

  @relation("products", "product_id")
  product!: Relation<Product>;

  @relation("product_units", "product_unit_id")
  productUnit!: Relation<ProductUnit>;

  @field("quantity")
  quantity!: number;

  @field("unit_price")
  unitPrice!: number;

  @field("total")
  total!: number;

  @children("sales_return_batch_allocations")
  batchAllocations!: Query<SalesReturnBatchAllocation>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
