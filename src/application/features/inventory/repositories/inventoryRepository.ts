import { ReferenceType } from "@core/constants";
import {
  AvailableBatchData,
  BatchQuantityChangeInput,
  CreateProductBatchInput,
  StockMovementData,
  StockMovementInput,
} from "../../../../core/types/inventory/inventory";
import { database } from "src/database";
import Product from "src/database/models/Product";
import ProductUnit from "src/database/models/ProductUnit";
import { Q } from "@nozbe/watermelondb";
import { map } from "rxjs";
import { STOCK_MOVEMENT_TYPES, REFERENCE_TYPES } from "@core/constants";
import { WatermelonInventoryRepository } from "@infrastructure/watermelon/repositories/WatermelonInventoryRepository";

export interface InventoryRepository {
  // -------------------------
  // Batches - Queries
  // -------------------------

  getBatchById(batchId: string): Promise<AvailableBatchData | null>;

  getAvailableBatches(productId: string): Promise<AvailableBatchData[]>;

  getBatchesByProduct(productId: string): Promise<AvailableBatchData[]>;

  // -------------------------
  // Batches - Mutations
  // -------------------------

  createBatch(input: CreateProductBatchInput): Promise<AvailableBatchData>;

  consumeBatches(allocations: BatchQuantityChangeInput[]): Promise<void>;

  restoreBatches(allocations: BatchQuantityChangeInput[]): Promise<void>;

  // -------------------------
  // Stock Movements
  // -------------------------

  createMovement(input: StockMovementInput): Promise<StockMovementData>;

  createMovements(inputs: StockMovementInput[]): Promise<StockMovementData[]>;

  getMovementsByProduct(productId: string): Promise<StockMovementData[]>;

  getMovementsByReference(
    referenceType: ReferenceType,
    referenceId: string,
  ): Promise<StockMovementData[]>;
}

const inventoryCore = new WatermelonInventoryRepository(database);
const products = database.get<Product>(Product.table);
const productUnits = database.get<ProductUnit>(ProductUnit.table);

export const inventoryRepository = Object.assign(inventoryCore, {
  getProductStock: async (productId: string) => {
    const batches = await inventoryCore.getBatchesByProduct(productId);
    return batches.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
  },
  observeProductStock: (productId: string) =>
    database
      .get("product_batches")
      .query(
        Q.where("product_id", productId),
        Q.where("quantity_remaining", Q.gt(0)),
      )
      .observe()
      .pipe(
        // ✅ تحويل مصفوفة الدفعات إلى مجموع quantityRemaining
        map((batches: any[]) =>
          batches.reduce((sum, b) => sum + (b.quantityRemaining || 0), 0),
        ),
      ),
  observeProductMovements: (productId: string) =>
    database.get("stock_movements").query(Q.where("product_id", productId), Q.sortBy("movement_date", Q.desc)).observe(),
  getLowStockProducts: async () => {
    const rows = await products.query(Q.where("is_active", true)).fetch();
    const result: Product[] = [];
    for (const product of rows) { const stock = await inventoryRepository.getProductStock(product.id); if (stock <= product.minStock && stock > 0) result.push(product); }
    return result;
  },
  getOutOfStockProducts: async () => {
    const rows = await products.query(Q.where("is_active", true)).fetch();
    const result: Product[] = [];
    for (const product of rows) if (await inventoryRepository.getProductStock(product.id) <= 0) result.push(product);
    return result;
  },
  adjustStock: async (productId: string, quantity: number) => {
    if (!Number.isFinite(quantity) || quantity === 0) throw new Error("ÙƒÙ…ÙŠØ© Ø§Ù„ØªØ¹Ø¯ÙŠÙ„ ÙŠØ¬Ø¨ Ø£Ù„Ø§ ØªØ³Ø§ÙˆÙŠ ØµÙØ±Ù‹Ø§.");
    const productUnit = (await productUnits.query(Q.where("product_id", productId), Q.take(1)).fetch())[0];
    if (!productUnit) throw new Error("Ù„Ø§ ØªÙˆØ¬Ø¯ ÙˆØ­Ø¯Ø© Ù…Ø®Ø²ÙˆÙ† Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ø§Ù„Ù…Ù†ØªØ¬.");
    return database.write(async () => {
      const now = new Date().toISOString().slice(0, 10);
      if (quantity > 0) {
        const batch = await inventoryCore.createBatch({ productId, quantityReceived: quantity, quantityRemaining: quantity, unitCost: 0, receivedDate: now });
        await inventoryCore.createMovement({ productId, productUnitId: productUnit.id, batchId: batch.id, quantity, movementType: STOCK_MOVEMENT_TYPES.ADJUSTMENT_IN, referenceType: REFERENCE_TYPES.STOCK_ADJUSTMENT, referenceId: productId, unitCost: 0, movementDate: now });
        return batch;
      }
      const required = Math.abs(quantity); const available = await inventoryCore.getAvailableBatches(productId); let remaining = required; const allocations: BatchQuantityChangeInput[] = [];
      for (const batch of available) { const used = Math.min(remaining, batch.quantityRemaining); if (used > 0) allocations.push({ batchId: batch.id, quantity: used }); remaining -= used; if (remaining <= 0) break; }
      if (remaining > 0) throw new Error("Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…ØªØ§Ø­ Ù„Ø§ ÙŠÙƒÙÙŠ Ù„ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†.");
      await inventoryCore.consumeBatches(allocations);
      await inventoryCore.createMovement({ productId, productUnitId: productUnit.id, quantity, movementType: STOCK_MOVEMENT_TYPES.ADJUSTMENT_OUT, referenceType: REFERENCE_TYPES.STOCK_ADJUSTMENT, referenceId: productId, unitCost: 0, movementDate: now });
      return null;
    });
  },
});

