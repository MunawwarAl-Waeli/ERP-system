export interface OutstandingDocument {
  id: string;
  outstandingAmount: number;
  date: string;
}

export interface PaymentAllocation {
  documentId: string;
  amount: number;
}

export class InsufficientOutstandingBalanceError extends Error {
  constructor(
    public readonly requestedAmount: number,
    public readonly availableAmount: number,
  ) {
    super(
      `Payment amount exceeds total outstanding balance. ` +
        `Requested: ${requestedAmount}, ` +
        `Available: ${availableAmount}.`,
    );

    this.name = "InsufficientOutstandingBalanceError";
  }
}

export function calculateOldestFirstAllocation(
  paymentAmount: number,
  documents: OutstandingDocument[],
): PaymentAllocation[] {
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const outstandingDocuments = documents
    .filter((document) => document.outstandingAmount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalOutstanding = outstandingDocuments.reduce(
    (sum, document) => sum + document.outstandingAmount,
    0,
  );

  if (paymentAmount > totalOutstanding) {
    throw new InsufficientOutstandingBalanceError(
      paymentAmount,
      totalOutstanding,
    );
  }

  let remainingAmount = paymentAmount;

  const allocations: PaymentAllocation[] = [];

  for (const document of outstandingDocuments) {
    if (remainingAmount <= 0) {
      break;
    }

    const allocationAmount = Math.min(
      remainingAmount,
      document.outstandingAmount,
    );

    allocations.push({
      documentId: document.id,
      amount: allocationAmount,
    });

    remainingAmount -= allocationAmount;
  }

  return allocations;
}
