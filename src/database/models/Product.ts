import { Model, Relation, Query } from "@nozbe/watermelondb";
import {
  field,
  text,
  date,
  relation,
  children,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import Category from "./Category";
import ProductUnit from "./ProductUnit";
import ProductBatch from "./ProductBatch";
import StockMovement from "./StockMovement";
import PurchaseInvoiceItem from "./PurchaseInvoiceItem";
import SalesInvoiceItem from "./SalesInvoiceItem";
import ChartOfAccount from "./ChartOfAccount";

export default class Product extends Model {
  static table = "products";

  static associations: Associations = {
    categories: {
      type: "belongs_to" as const,
      key: "category_id",
    },

    inventory_accounts: {
      type: "belongs_to" as const,
      key: "inventory_account_id",
    },

    sales_accounts: {
      type: "belongs_to" as const,
      key: "sales_account_id",
    },

    cogs_accounts: {
      type: "belongs_to" as const,
      key: "cogs_account_id",
    },

    product_units: {
      type: "has_many" as const,
      foreignKey: "product_id",
    },

    product_batches: {
      type: "has_many" as const,
      foreignKey: "product_id",
    },

    stock_movements: {
      type: "has_many" as const,
      foreignKey: "product_id",
    },

    purchase_invoice_items: {
      type: "has_many" as const,
      foreignKey: "product_id",
    },

    sales_invoice_items: {
      type: "has_many" as const,
      foreignKey: "product_id",
    },
  };
  @text("category_id")
  categoryId?: string;

  @text("inventory_account_id")
  inventoryAccountId!: string;

  @text("sales_account_id")
  salesAccountId!: string;

  @text("cogs_account_id")
  cogsAccountId!: string;

  @relation("categories", "category_id")
  category?: Relation<Category>;

  @relation("inventory_accounts", "inventory_account_id")
  inventoryAccount!: Relation<ChartOfAccount>;

  @relation("sales_accounts", "sales_account_id")
  salesAccount!: Relation<ChartOfAccount>;

  @relation("cogs_accounts", "cogs_account_id")
  cogsAccount!: Relation<ChartOfAccount>;

  @text("name")
  name!: string;

  @text("sku")
  sku?: string;

  @field("last_purchase_cost")
  lastPurchaseCost!: number;

  @field("min_stock")
  minStock!: number;

  @field("is_active")
  isActive!: boolean;

  @children("product_units")
  productUnits!: Query<ProductUnit>;

  @children("product_batches")
  batches!: Query<ProductBatch>;

  @children("stock_movements")
  stockMovements!: Query<StockMovement>;

  @children("purchase_invoice_items")
  purchaseInvoiceItems!: Query<PurchaseInvoiceItem>;

  @children("sales_invoice_items")
  salesInvoiceItems!: Query<SalesInvoiceItem>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
