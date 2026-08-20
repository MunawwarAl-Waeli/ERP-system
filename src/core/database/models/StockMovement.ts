import { Model } from "@nozbe/watermelondb";
import {
  field,
  text,
  date,
  readonly,
  immutableRelation,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";
import Product from "./Product";
import ProductUnit from "./ProductUnit";


export type StockMovementType =
  | "purchase_in"
  | "sale_out"
  | "sale_return"
  | "purchase_return"
  | "adjustment_in"
  | "adjustment_out";

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
    // ✅ العلاقة الجديدة مع جدول الدفعات
    product_batches: {
      type: "belongs_to" as const,
      key: "batch_id",
    },
  };

  // ========== الحقول ==========
  @field("product_id")
  productId!: string;

  @field("product_unit_id")
  productUnitId!: string;

  @field("batch_id")
  batchId?: string | null;

  @field("quantity")
  quantity!: number;

  @field("movement_type")
  movementType!: StockMovementType;

  @text("reference_type")
  referenceType?: string | null;

  @text("reference_id")
  referenceId?: string | null;

  @field("unit_cost")
  unitCost!: number;

  @date("movement_date")
  movementDate!: Date;

  @readonly
  @date("created_at")
  createdAt!: Date;

  @readonly
  @date("updated_at")
  updatedAt!: Date;

  // ========== العلاقات ==========
  @immutableRelation("products", "product_id")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  product!: Product; // يُفضل استبدالها بـ Product لاحقاً

  @immutableRelation("product_units", "product_unit_id")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productUnit!: ProductUnit; // يُفضل استبدالها بـ ProductUnit

  // @immutableRelation("product_batches", "batch_id")
  // batch?: ProductBatch; // يُفضل استبدالها بـ ProductBatch
}
