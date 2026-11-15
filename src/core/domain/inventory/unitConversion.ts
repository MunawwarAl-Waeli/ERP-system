import { ACCOUNTING } from "@core/constants";

export class InvalidUnitConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUnitConversionError";
  }
}

export class InvalidBaseQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBaseQuantityError";
  }
}

export class InvalidBaseUnitCostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBaseUnitCostError";
  }
}

export interface UnitConversionInput {
  quantity: number;
  conversionFactor: number;
}

/**
 * Converts a transaction quantity to the inventory base unit.
 *
 * Base unit = piece.
 *
 * Example:
 * 2 cartons × 12 pieces = 24 pieces.
 *
 * Fractional base quantities are not allowed.
 */
export function convertToBaseUnit({
  quantity,
  conversionFactor,
}: UnitConversionInput): number {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new InvalidUnitConversionError("Quantity must be greater than zero.");
  }

  if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
    throw new InvalidUnitConversionError(
      "Conversion factor must be greater than zero.",
    );
  }

  const baseQuantity = quantity * conversionFactor;

  if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) {
    throw new InvalidUnitConversionError("Invalid base unit quantity.");
  }

  if (!Number.isInteger(baseQuantity)) {
    throw new InvalidBaseQuantityError(
      "Base unit quantity must be a whole number.",
    );
  }

  return baseQuantity;
}

/**
 * Converts a transaction-unit cost to base-unit cost.
 *
 * The returned value remains in the same scaled-money
 * representation used by the application.
 *
 * No rounding is performed.
 *
 * Example:
 *
 * unitCost = 12,000
 * conversionFactor = 12
 *
 * baseUnitCost = 1,000
 *
 * Valid because:
 *
 * 1,000 × MONEY_SCALE = 1,000,000
 *
 * is exactly representable.
 */
export function convertUnitCostToBaseUnit({
  unitCost,
  conversionFactor,
}: {
  unitCost: number;
  conversionFactor: number;
}): number {
  if (!Number.isFinite(unitCost) || unitCost <= 0) {
    throw new InvalidBaseUnitCostError("Unit cost must be greater than zero.");
  }

  if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
    throw new InvalidBaseUnitCostError(
      "Conversion factor must be greater than zero.",
    );
  }

  const baseUnitCost = unitCost / conversionFactor;

  if (!Number.isFinite(baseUnitCost) || baseUnitCost <= 0) {
    throw new InvalidBaseUnitCostError("Invalid base unit cost.");
  }

  /*
   * We do NOT round the monetary value.
   *
   * Math.round is used only to determine whether the
   * calculated value is already representable as an
   * integer at the configured money scale.
   *
   * The rounded value is NEVER returned or stored.
   */
  const scaledBaseUnitCost = baseUnitCost * ACCOUNTING.MONEY_SCALE;

  if (!Number.isFinite(scaledBaseUnitCost)) {
    throw new InvalidBaseUnitCostError(
      "Base unit cost cannot be represented using the configured money scale.",
    );
  }

  const nearestInteger = Math.round(scaledBaseUnitCost);

  /*
   * JavaScript floating-point arithmetic can produce tiny
   * errors such as:
   *
   * 1000 × 1000 = 999999.9999999999
   *
   * Therefore we allow only an extremely small numerical
   * representation error.
   *
   * This is NOT monetary rounding.
   */
  const precisionTolerance = 1e-9;

  if (Math.abs(scaledBaseUnitCost - nearestInteger) > precisionTolerance) {
    throw new InvalidBaseUnitCostError(
      "Base unit cost cannot be represented exactly using the configured money scale.",
    );
  }

  if (!Number.isSafeInteger(nearestInteger)) {
    throw new InvalidBaseUnitCostError(
      "Base unit cost exceeds the safe numeric range.",
    );
  }

  return baseUnitCost;
}
