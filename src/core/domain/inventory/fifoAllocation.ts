export interface FIFOAvailableBatch {
  id: string;
  productId: string;
  quantityRemaining: number;
  unitCost: number;
  receivedDate: string;
}

export interface FIFOAllocation {
  batchId: string;
  quantityConsumed: number;
  unitCost: number;
  totalCost: number;
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly productId: string,
    public readonly requestedQuantity: number,
    public readonly availableQuantity: number,
  ) {
    super(
      `Insufficient stock for product ${productId}. ` +
        `Requested: ${requestedQuantity}, ` +
        `Available: ${availableQuantity}.`,
    );

    this.name = "InsufficientStockError";
  }
}

export function calculateFIFOAllocation(
  productId: string,
  requestedQuantity: number,
  availableBatches: FIFOAvailableBatch[],
): FIFOAllocation[] {
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
    throw new Error("Requested quantity must be greater than zero.");
  }

  const batches = availableBatches
    .filter(
      (batch) => batch.productId === productId && batch.quantityRemaining > 0,
    )
    .sort((a, b) => a.receivedDate.localeCompare(b.receivedDate));

  const totalAvailable = batches.reduce(
    (sum, batch) => sum + batch.quantityRemaining,
    0,
  );

  if (totalAvailable < requestedQuantity) {
    throw new InsufficientStockError(
      productId,
      requestedQuantity,
      totalAvailable,
    );
  }

  let remainingQuantity = requestedQuantity;

  const allocations: FIFOAllocation[] = [];

  for (const batch of batches) {
    if (remainingQuantity <= 0) {
      break;
    }

    const quantityConsumed = Math.min(
      remainingQuantity,
      batch.quantityRemaining,
    );

    allocations.push({
      batchId: batch.id,
      quantityConsumed,
      unitCost: batch.unitCost,
      totalCost: quantityConsumed * batch.unitCost,
    });

    remainingQuantity -= quantityConsumed;
  }

  return allocations;
}
// مثال
// لدينا:
// Batch A
// received = 01/09
// remaining = 10
// cost = 100

// Batch B
// received = 05/09
// remaining = 20
// cost = 120
// والبيع:
// 15 pieces
// النتيجة:
// Batch A → 10 × 100
// Batch B →  5 × 120
// والـ COGS:
// 1,000 + 600 = 1,600
// لكن لاحظ:
// هذا الملف لا يغير الكميات في قاعدة البيانات.
// هو فقط يقول:
// هذه هي الكميات التي يجب استهلاكها.
// ثم InventoryRepository.consumeBatches() ينفذ القرار.