import { Model, Relation } from "@nozbe/watermelondb";
import {
  field,
  date,
  relation,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import SalesReturnItem from "./SalesReturnItem";
import ProductBatch from "./ProductBatch";

export default class SalesReturnBatchAllocation extends Model {
  static table = "sales_return_batch_allocations";

  static associations: Associations = {
    sales_return_items: {
      type: "belongs_to" as const,
      key: "sales_return_item_id",
    },

    product_batches: {
      type: "belongs_to" as const,
      key: "batch_id",
    },
  };

  @relation("sales_return_items", "sales_return_item_id")
  salesReturnItem!: Relation<SalesReturnItem>;

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
