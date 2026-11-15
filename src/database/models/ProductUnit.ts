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
import Unit from "./Unit";

export default class ProductUnit extends Model {
  static table = "product_units";

  static associations: Associations = {
    products: {
      type: "belongs_to" as const,
      key: "product_id",
    },

    units: {
      type: "belongs_to" as const,
      key: "unit_id",
    },
  };
  @text("product_id")
  productId!: string;

  @text("unit_id")
  unitId!: string;
  
  @relation("products", "product_id")
  product!: Relation<Product>;

  @relation("units", "unit_id")
  unit!: Relation<Unit>;

  @text("barcode")
  barcode?: string;

  @field("conversion_factor")
  conversionFactor!: number;

  @field("sale_price")
  salePrice!: number;

  @field("purchase_price")
  purchasePrice!: number;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
