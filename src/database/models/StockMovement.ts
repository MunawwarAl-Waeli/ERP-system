import { Model, Relation } from "@nozbe/watermelondb";
import {
  field,
  text,
  date,
  relation,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import Product from "./Product";
import ProductUnit from "./ProductUnit";
import ProductBatch from "./ProductBatch";
import { StockMovementType } from "@core/constants";

export default class StockMovement extends Model {
  static table = "stock_movements";

  static associations: Associations = {
    products: {
      type: "belongs_to" as const,
      key: "product_id",
    },

    product_units: {
      type: "belongs_to" as const,
      key: "product_unit_id",
    },

    product_batches: {
      type: "belongs_to" as const,
      key: "batch_id",
    },
  };

  @relation("products", "product_id")
  product!: Relation<Product>;

  @relation("product_units", "product_unit_id")
  productUnit!: Relation<ProductUnit>;

  @relation("product_batches", "batch_id")
  productBatch!: Relation<ProductBatch>;

  @field("quantity")
  quantity!: number;

  @text("movement_type")
  movementType!: StockMovementType;

  @text("reference_type")
  referenceType?: string|null;

  @text("reference_id")
  referenceId?: string|null;
  @text("product_id")
  productId!: string;

  @text("product_unit_id")
  productUnitId!: string;

  @text("batch_id")
  batchId?: string;
  @field("unit_cost")
  unitCost!: number;

  @date("movement_date")
  movementDate!: number;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
