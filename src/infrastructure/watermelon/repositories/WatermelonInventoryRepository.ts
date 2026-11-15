import { Database, Q } from "@nozbe/watermelondb";

import ProductBatch from "src/database/models/ProductBatch";
import StockMovement from "src/database/models/StockMovement";

import { ReferenceType } from "@core/constants";

import {
  AvailableBatchData,
  BatchQuantityChangeInput,
  CreateProductBatchInput,
  StockMovementData,
  StockMovementInput,
} from "@core/types/inventory/inventory";

import type { InventoryRepository } from "@application/features/inventory/repositories/inventoryRepository";

export class WatermelonInventoryRepository implements InventoryRepository {
  private readonly batches;
  private readonly movements;

  constructor(private readonly database: Database) {
    this.batches = this.database.get<ProductBatch>(ProductBatch.table);

    this.movements = this.database.get<StockMovement>(StockMovement.table);
  }

  // =========================================================
  // BATCH QUERIES
  // =========================================================

  async getBatchById(batchId: string): Promise<AvailableBatchData | null> {
    try {
      const batch = await this.batches.find(batchId);

      return this.toBatchData(batch);
    } catch {
      return null;
    }
  }

  async getAvailableBatches(productId: string): Promise<AvailableBatchData[]> {
    const records = await this.batches
      .query(
        Q.where("product_id", productId),
        Q.where("quantity_remaining", Q.gt(0)),
        Q.sortBy("received_date", Q.asc),
        Q.sortBy("id", Q.asc),
      )
      .fetch();

    return records.map((batch: ProductBatch) => this.toBatchData(batch));
  }

  async getBatchesByProduct(productId: string): Promise<AvailableBatchData[]> {
    const records = await this.batches
      .query(
        Q.where("product_id", productId),
        Q.sortBy("received_date", Q.asc),
        Q.sortBy("id", Q.asc),
      )
      .fetch();

    return records.map((batch: ProductBatch) => this.toBatchData(batch));
  }

  // =========================================================
  // BATCH CREATION
  // =========================================================

  async createBatch(
    input: CreateProductBatchInput,
  ): Promise<AvailableBatchData> {
    this.validateBatchInput(input);

    const batch = await this.batches.create((record: { productId: string; purchaseItemId: string | undefined; quantityReceived: number; quantityRemaining: number; unitCost: number; receivedDate: number; }) => {
      record.productId = input.productId;

      record.purchaseItemId = input.purchaseItemId;

      record.quantityReceived = input.quantityReceived;

      record.quantityRemaining = input.quantityRemaining;

      record.unitCost = input.unitCost;

      record.receivedDate = this.toTimestamp(input.receivedDate);
    });

    return this.toBatchData(batch);
  }

  // =========================================================
  // CONSUME BATCHES
  // =========================================================
/**
 * 
 * @param allocations جلب جميع الدفعات (Batches) المطلوبة بـ استعلام واحد فقط باستخدام Q.oneOf، ثم معالجتها في الذاكرة (Memory). هذا سيجعل الدالة أسرع بأضعاف مضاعفة:
 * @returns 
 */
  async consumeBatches(allocations: BatchQuantityChangeInput[]): Promise<void> {
    this.validateAllocations(allocations);
    if (allocations.length === 0) return;

    // 1. استخراج كل الأيديهات
    const batchIds = allocations.map((a) => a.batchId);

    // 2. جلب جميع الدفعات باستعلام واحد فقط!
    const batches = await this.batches
      .query(Q.where("id", Q.oneOf(batchIds)))
      .fetch();

    // تحويلها لـ Map لسهولة الوصول إليها
    const batchesMap = new Map<string, ProductBatch>(batches.map((b: { id: any; }) => [b.id, b]));
    const updates: any[] = [];

    for (const allocation of allocations) {
      const batch = batchesMap.get(allocation.batchId);

      if (!batch) {
        throw new Error(`Batch ${allocation.batchId} not found.`);
      }

      if (batch.quantityRemaining < allocation.quantity) {
        throw new Error(
          `Insufficient quantity in batch ${allocation.batchId}.`,
        );
      }

      const newRemaining = batch.quantityRemaining - allocation.quantity;
      updates.push(
        batch.prepareUpdate((record) => {
          record.quantityRemaining = newRemaining;
        }),
      );
    }

    // 3. تحديث الجميع بضربة واحدة
    await this.database.batch(...updates);
  }

  // async consumeBatches(allocations: BatchQuantityChangeInput[]): Promise<void> {
  //   this.validateAllocations(allocations);

  //   if (allocations.length === 0) {
  //     return;
  //   }

  //   const updates = [];

  //   for (const allocation of allocations) {
  //     const batch = await this.batches.find(allocation.batchId);

  //     if (batch.quantityRemaining < allocation.quantity) {
  //       throw new Error(
  //         `Insufficient quantity in batch ${allocation.batchId}.`,
  //       );
  //     }

  //     const newRemaining = batch.quantityRemaining - allocation.quantity;

  //     updates.push(
  //       batch.prepareUpdate((record) => {
  //         record.quantityRemaining = newRemaining;
  //       }),
  //     );
  //   }

  //   await this.database.batch(...updates);
  // }

  // =========================================================
  // RESTORE BATCHES
  // =========================================================

  async restoreBatches(allocations: BatchQuantityChangeInput[]): Promise<void> {
    this.validateAllocations(allocations);

    if (allocations.length === 0) {
      return;
    }

    const updates: any[] = [];

    for (const allocation of allocations) {
      const batch = await this.batches.find(allocation.batchId);

      if (
        batch.quantityReceived <
        batch.quantityRemaining + allocation.quantity
      ) {
        throw new Error(
          `Cannot restore more than originally received in batch ${allocation.batchId}.`,
        );
      }

      const newRemaining = batch.quantityRemaining + allocation.quantity;

      updates.push(
        batch.prepareUpdate((record: { quantityRemaining: any; }) => {
          record.quantityRemaining = newRemaining;
        }),
      );
    }

    await this.database.batch(...updates);
  }

  // =========================================================
  // STOCK MOVEMENTS
  // =========================================================

  async createMovement(input: StockMovementInput): Promise<StockMovementData> {
    this.validateMovementInput(input);

    const movement = await this.movements.create((record: { productId: string; productUnitId: string; batchId: string | undefined; quantity: number; movementType: string; referenceType: string | null; referenceId: string | null; unitCost: number; movementDate: number; }) => {
      record.productId = input.productId;

      record.productUnitId = input.productUnitId;

      record.batchId = input.batchId;

      record.quantity = input.quantity;

      record.movementType = input.movementType;

      record.referenceType = input.referenceType ?? null;

      record.referenceId = input.referenceId ?? null;

      record.unitCost = input.unitCost;

      record.movementDate = this.toTimestamp(input.movementDate);
    });

    return this.toMovementData(movement);
  }

  async createMovements(
    inputs: StockMovementInput[],
  ): Promise<StockMovementData[]> {
    if (inputs.length === 0) {
      return [];
    }

    inputs.forEach((input) => this.validateMovementInput(input));

    const preparedMovements = inputs.map((input) =>
      this.movements.prepareCreate((record: { productId: string; productUnitId: string; batchId: string | undefined; quantity: number; movementType: string; referenceType: string | null; referenceId: string | null; unitCost: number; movementDate: number; }) => {
        record.productId = input.productId;

        record.productUnitId = input.productUnitId;

        record.batchId = input.batchId;

        record.quantity = input.quantity;

        record.movementType = input.movementType;

        record.referenceType = input.referenceType ?? null;

        record.referenceId = input.referenceId ?? null;

        record.unitCost = input.unitCost;

        record.movementDate = this.toTimestamp(input.movementDate);
      }),
    );

    await this.database.batch(...preparedMovements);

    // return Promise.all(
    //   preparedMovements.map(async (prepared) => {
    //     const movement = await this.movements.find(prepared.id);

    //     return this.toMovementData(movement);
    //   }),
    // );
    // ✅ الكود المحسن (استجابة فورية)
    return preparedMovements.map((prepared) =>
      this.toMovementData(prepared as StockMovement),
    );
  }

  // =========================================================
  // MOVEMENT QUERIES
  // =========================================================

  async getMovementsByProduct(productId: string): Promise<StockMovementData[]> {
    const records = await this.movements
      .query(
        Q.where("product_id", productId),
        Q.sortBy("movement_date", Q.asc),
        Q.sortBy("created_at", Q.asc),
      )
      .fetch();

    return records.map((movement: StockMovement) => this.toMovementData(movement));
  }

  async getMovementsByReference(
    referenceType: ReferenceType,
    referenceId: string,
  ): Promise<StockMovementData[]> {
    const records = await this.movements
      .query(
        Q.where("reference_type", referenceType),
        Q.where("reference_id", referenceId),
        Q.sortBy("movement_date", Q.asc),
        Q.sortBy("created_at", Q.asc),
      )
      .fetch();

    return records.map((movement: StockMovement) => this.toMovementData(movement));
  }

  // =========================================================
  // MAPPERS
  // =========================================================

  private toBatchData(batch: ProductBatch): AvailableBatchData {
    return {
      id: batch.id,
      productId: batch.product.id,
      quantityRemaining: batch.quantityRemaining,
      unitCost: batch.unitCost,
      receivedDate: this.fromTimestamp(batch.receivedDate),
    };
  }

  private toMovementData(movement: StockMovement): StockMovementData {
    return {
      id: movement.id,
      productId: movement.product.id,
      productUnitId: movement.productUnit.id,
      batchId: movement.productBatch.id,
      quantity: movement.quantity,
      movementType: movement.movementType,
      referenceType: movement.referenceType
        ? (movement.referenceType as ReferenceType)
        : undefined,
      referenceId: movement.referenceId ?? undefined,
      unitCost: movement.unitCost,
      movementDate: this.fromTimestamp(movement.movementDate),
    };
  }

  // =========================================================
  // VALIDATION
  // =========================================================

  private validateBatchInput(input: CreateProductBatchInput): void {
    if (!input.productId) {
      throw new Error("Product ID is required.");
    }

    if (
      !Number.isFinite(input.quantityReceived) ||
      input.quantityReceived <= 0
    ) {
      throw new Error("Quantity received must be greater than zero.");
    }

    if (
      !Number.isFinite(input.quantityRemaining) ||
      input.quantityRemaining < 0
    ) {
      throw new Error("Quantity remaining cannot be negative.");
    }

    if (input.quantityRemaining > input.quantityReceived) {
      throw new Error("Quantity remaining cannot exceed quantity received.");
    }

    if (!Number.isFinite(input.unitCost) || input.unitCost < 0) {
      throw new Error("Unit cost cannot be negative.");
    }

    this.validateDate(input.receivedDate);
  }

  private validateAllocations(allocations: BatchQuantityChangeInput[]): void {
    for (const allocation of allocations) {
      if (!allocation.batchId) {
        throw new Error("Batch ID is required.");
      }

      if (!Number.isFinite(allocation.quantity) || allocation.quantity <= 0) {
        throw new Error("Batch allocation quantity must be greater than zero.");
      }
    }
  }

  private validateMovementInput(input: StockMovementInput): void {
    if (!input.productId) {
      throw new Error("Product ID is required.");
    }

    if (!input.productUnitId) {
      throw new Error("Product unit ID is required.");
    }

    if (!Number.isFinite(input.quantity) || input.quantity === 0) {
      throw new Error("Stock movement quantity cannot be zero.");
    }

    if (!Number.isFinite(input.unitCost) || input.unitCost < 0) {
      throw new Error("Unit cost cannot be negative.");
    }

    this.validateDate(input.movementDate);
  }

  private validateDate(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid date. Expected YYYY-MM-DD: ${date}`);
    }

    const timestamp = Date.parse(`${date}T00:00:00.000Z`);

    if (!Number.isFinite(timestamp)) {
      throw new Error(`Invalid date: ${date}`);
    }
  }

  // =========================================================
  // DATE HELPERS
  // =========================================================

  private toTimestamp(date: string): number {
    this.validateDate(date);

    return Date.parse(`${date}T00:00:00.000Z`);
  }

  private fromTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}
