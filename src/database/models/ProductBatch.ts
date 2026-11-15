import { Model, Relation, Query } from "@nozbe/watermelondb";
import {
  field,
  date,
  text,
  relation,
  children,
  readonly,
} from "@nozbe/watermelondb/decorators";
import { Associations } from "@nozbe/watermelondb/Model";

import Product from "./Product";
import PurchaseInvoiceItem from "./PurchaseInvoiceItem";
import StockMovement from "./StockMovement";
import SaleItemBatchConsumption from "./SaleItemBatchConsumption";
import SalesReturnBatchAllocation from "./SalesReturnBatchAllocation";

export default class ProductBatch extends Model {
  static table = "product_batches";

  static associations: Associations = {
    products: {
      type: "belongs_to" as const,
      key: "product_id",
    },

    purchase_items: {
      type: "belongs_to" as const,
      key: "purchase_item_id",
    },

    stock_movements: {
      type: "has_many" as const,
      foreignKey: "batch_id",
    },

    sale_item_batch_consumptions: {
      type: "has_many" as const,
      foreignKey: "batch_id",
    },

    sales_return_batch_allocations: {
      type: "has_many" as const,
      foreignKey: "batch_id",
    },
  };

  @relation("products", "product_id")
  product!: Relation<Product>;

  @relation("purchase_items", "purchase_item_id")
  purchaseItem!: Relation<PurchaseInvoiceItem>;

  @field("quantity_received")
  quantityReceived!: number;

  @field("quantity_remaining")
  quantityRemaining!: number;

  @field("unit_cost")
  unitCost!: number;
  @text("product_id")
  productId!: string;
  @text("purchase_item_id")
  purchaseItemId?: string;
  @date("received_date")
  receivedDate!: number;

  @children("stock_movements")
  stockMovements!: Query<StockMovement>;

  @children("sale_item_batch_consumptions")
  saleItemBatchConsumptions!: Query<SaleItemBatchConsumption>;

  @children("sales_return_batch_allocations")
  salesReturnBatchAllocations!: Query<SalesReturnBatchAllocation>;

  @readonly
  @date("created_at")
  createdAt!: number;

  @readonly
  @date("updated_at")
  updatedAt!: number;
}
