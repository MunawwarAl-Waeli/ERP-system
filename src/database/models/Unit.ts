import { Model, Query } from "@nozbe/watermelondb";
import { text, date, children, readonly } from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import ProductUnit from "./ProductUnit";

export default class Unit extends Model {
  static table = "units";

  static associations: Associations = {
    product_units: {
      type: "has_many" as const,
      foreignKey: "unit_id",
    },
  };

  @text("name")
  name!: string;
  @text("code") code!: string;
  @children("product_units")
  productUnits!: Query<ProductUnit>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
