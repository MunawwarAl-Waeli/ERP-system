import { Model, Query } from "@nozbe/watermelondb";
import { text, date, children, readonly } from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import Product from "./Product";

export default class Category extends Model {
  static table = "categories";

  static associations: Associations = {
    products: {
      type: "has_many" as const,
      foreignKey: "category_id",
    },
  };

  @text("name")
  name!: string;

  @text("icon")
  icon?: string;

  // ✅ حسابات التصنيف (المنتجات ترث منها)
  @text("inventory_account_id")
  inventoryAccountId?: string | null;

  @text("sales_account_id")
  salesAccountId?: string | null;

  @text("cogs_account_id")
  cogsAccountId?: string | null;

  @readonly
  @date("created_at")
  createdAt!: number;

  @children("products")
  products!: Query<Product>;
}

