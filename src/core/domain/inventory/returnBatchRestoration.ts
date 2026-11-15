export interface ConsumedBatch {
  batchId: string;
  quantityConsumed: number;
  unitCost: number;
}

export interface ReturnBatchRestoration {
  batchId: string;
  quantityRestored: number;
  unitCost: number;
}

export class InvalidReturnRestorationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReturnRestorationError";
  }
}

export function calculateReturnBatchRestoration(
  requestedReturnQuantity: number,
  consumedBatches: ConsumedBatch[],
): ReturnBatchRestoration[] {
  if (
    !Number.isFinite(requestedReturnQuantity) ||
    requestedReturnQuantity <= 0
  ) {
    throw new InvalidReturnRestorationError(
      "Return quantity must be greater than zero.",
    );
  }

  if (consumedBatches.length === 0) {
    throw new InvalidReturnRestorationError(
      "No batch consumption records were found for this sale item.",
    );
  }

  const totalConsumed = consumedBatches.reduce(
    (sum, batch) => sum + batch.quantityConsumed,
    0,
  );

  if (requestedReturnQuantity > totalConsumed) {
    throw new InvalidReturnRestorationError(
      "Return quantity cannot exceed the quantity consumed by the sale.",
    );
  }

  let remainingQuantity = requestedReturnQuantity;

  const restorations: ReturnBatchRestoration[] = [];

  for (let index = consumedBatches.length - 1; index >= 0; index -= 1) {
    if (remainingQuantity <= 0) {
      break;
    }

    const batch = consumedBatches[index];

    const quantityRestored = Math.min(
      remainingQuantity,
      batch.quantityConsumed,
    );

    restorations.push({
      batchId: batch.batchId,
      quantityRestored,
      unitCost: batch.unitCost,
    });

    remainingQuantity -= quantityRestored;
  }

  return restorations;
}
// مثال
// البيع الأصلي:
// Batch A → 10
// Batch B → 20
// Batch C → 5
// المرتجع:
// 15
// النتيجة:
// Batch C → 5
// Batch B → 10
// وليس:
// Batch A → 15
// وهذا بالضبط سبب فصل:
// fifoAllocation.ts
// عن:
// returnBatchRestoration.ts