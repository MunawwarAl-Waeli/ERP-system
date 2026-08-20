import { Model, Query } from "@nozbe/watermelondb";
import {
  text,
  field,
  date,
  readonly,
  children,
  immutableRelation,
  writer,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";
import ProductUnit from "./ProductUnit";

export default class Product extends Model {
  static table = "products";

  static associations: Associations = {
    categories: { type: "belongs_to" as const, key: "category_id" },
    product_units: { type: "has_many" as const, foreignKey: "product_id" },
    sales_invoice_items: {
      type: "has_many" as const,
      foreignKey: "product_id",
    },
    purchase_invoice_items: {
      type: "has_many" as const,
      foreignKey: "product_id",
    },
  };

  @text("name") name!: string;
  @field("category_id") categoryId?: string | null;
  @text("sku") sku?: string | null;
  @field("last_purchase_cost") lastPurchaseCost!: number;
  @field("min_stock") minStock!: number;
  @field("is_active") isActive!: boolean;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation("categories", "category_id") category: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
@children("product_units")productUnits!: Query<ProductUnit>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @children("sales_invoice_items") salesInvoiceItems: any;

  @writer async updateProduct(data: {
    name?: string;
    categoryId?: string | null;
    sku?: string | null;
    lastPurchaseCost?: number;
    minStock?: number;
  }) {
    await this.update((product: Product) => {
      if (data.name !== undefined) {
        product.name = data.name;
      }
      if (data.categoryId !== undefined) {
        product.categoryId = data.categoryId;
      }
      if (data.sku !== undefined) {
        product.sku = data.sku;
      }
      if (data.lastPurchaseCost !== undefined) {
        product.lastPurchaseCost = data.lastPurchaseCost;
      }
      if (data.minStock !== undefined) {
        product.minStock = data.minStock;
      }
    });
  }

}

