import { ACCOUNTING } from "@core/constants";

import {
  convertToBaseUnit,
  convertUnitCostToBaseUnit,
  InvalidBaseQuantityError,
  InvalidBaseUnitCostError,
  InvalidUnitConversionError,
} from "@core/domain/inventory/unitConversion";

describe("unitConversion", () => {
  describe("convertToBaseUnit", () => {
    it("converts transaction quantity to base quantity", () => {
      const result = convertToBaseUnit({
        quantity: 2,
        conversionFactor: 12,
      });

      expect(result).toBe(24);
    });

    it("accepts fractional transaction quantity when the resulting base quantity is an integer", () => {
      const result = convertToBaseUnit({
        quantity: 2.5,
        conversionFactor: 12,
      });

      expect(result).toBe(30);
    });

    it("rejects fractional base quantity", () => {
      expect(() =>
        convertToBaseUnit({
          quantity: 2.5,
          conversionFactor: 3,
        }),
      ).toThrow(InvalidBaseQuantityError);

      expect(() =>
        convertToBaseUnit({
          quantity: 2.5,
          conversionFactor: 3,
        }),
      ).toThrow("Base unit quantity must be a whole number.");
    });

    it("accepts one transaction unit", () => {
      const result = convertToBaseUnit({
        quantity: 1,
        conversionFactor: 12,
      });

      expect(result).toBe(12);
    });

    it("accepts conversion factor of one", () => {
      const result = convertToBaseUnit({
        quantity: 5,
        conversionFactor: 1,
      });

      expect(result).toBe(5);
    });

    it("rejects zero quantity", () => {
      expect(() =>
        convertToBaseUnit({
          quantity: 0,
          conversionFactor: 12,
        }),
      ).toThrow(InvalidUnitConversionError);
    });

    it("rejects negative quantity", () => {
      expect(() =>
        convertToBaseUnit({
          quantity: -1,
          conversionFactor: 12,
        }),
      ).toThrow(InvalidUnitConversionError);
    });

    it("rejects NaN quantity", () => {
      expect(() =>
        convertToBaseUnit({
          quantity: Number.NaN,
          conversionFactor: 12,
        }),
      ).toThrow(InvalidUnitConversionError);
    });

    it("rejects Infinity quantity", () => {
      expect(() =>
        convertToBaseUnit({
          quantity: Number.POSITIVE_INFINITY,
          conversionFactor: 12,
        }),
      ).toThrow(InvalidUnitConversionError);
    });

    it("rejects zero conversion factor", () => {
      expect(() =>
        convertToBaseUnit({
          quantity: 5,
          conversionFactor: 0,
        }),
      ).toThrow(InvalidUnitConversionError);
    });

    it("rejects negative conversion factor", () => {
      expect(() =>
        convertToBaseUnit({
          quantity: 5,
          conversionFactor: -2,
        }),
      ).toThrow(InvalidUnitConversionError);
    });

    it("rejects NaN conversion factor", () => {
      expect(() =>
        convertToBaseUnit({
          quantity: 5,
          conversionFactor: Number.NaN,
        }),
      ).toThrow(InvalidUnitConversionError);
    });

    it("rejects Infinity conversion factor", () => {
      expect(() =>
        convertToBaseUnit({
          quantity: 5,
          conversionFactor: Number.POSITIVE_INFINITY,
        }),
      ).toThrow(InvalidUnitConversionError);
    });

    it("rejects invalid resulting base quantity", () => {
      expect(() =>
        convertToBaseUnit({
          quantity: Number.MAX_VALUE,
          conversionFactor: Number.MAX_VALUE,
        }),
      ).toThrow(InvalidUnitConversionError);
    });
  });

  describe("convertUnitCostToBaseUnit", () => {
    it("converts an exact transaction-unit cost to base-unit cost", () => {
      const result = convertUnitCostToBaseUnit({
        unitCost: 12_000,
        conversionFactor: 12,
      });

      expect(result).toBe(1_000);
    });

    it("works when conversion factor is one", () => {
      const result = convertUnitCostToBaseUnit({
        unitCost: 5_000,
        conversionFactor: 1,
      });

      expect(result).toBe(5_000);
    });

    it("rejects a base-unit cost that cannot be represented exactly with MONEY_SCALE", () => {
      expect(() =>
        convertUnitCostToBaseUnit({
          unitCost: 10_000,
          conversionFactor: 3,
        }),
      ).toThrow(InvalidBaseUnitCostError);

      expect(() =>
        convertUnitCostToBaseUnit({
          unitCost: 10_000,
          conversionFactor: 3,
        }),
      ).toThrow(
        "Base unit cost cannot be represented exactly using the configured money scale.",
      );
    });

    it("rejects zero unit cost", () => {
      expect(() =>
        convertUnitCostToBaseUnit({
          unitCost: 0,
          conversionFactor: 12,
        }),
      ).toThrow(InvalidBaseUnitCostError);
    });

    it("rejects negative unit cost", () => {
      expect(() =>
        convertUnitCostToBaseUnit({
          unitCost: -1_000,
          conversionFactor: 12,
        }),
      ).toThrow(InvalidBaseUnitCostError);
    });

    it("rejects NaN unit cost", () => {
      expect(() =>
        convertUnitCostToBaseUnit({
          unitCost: Number.NaN,
          conversionFactor: 12,
        }),
      ).toThrow(InvalidBaseUnitCostError);
    });

    it("rejects Infinity unit cost", () => {
      expect(() =>
        convertUnitCostToBaseUnit({
          unitCost: Number.POSITIVE_INFINITY,
          conversionFactor: 12,
        }),
      ).toThrow(InvalidBaseUnitCostError);
    });

    it("rejects zero conversion factor", () => {
      expect(() =>
        convertUnitCostToBaseUnit({
          unitCost: 12_000,
          conversionFactor: 0,
        }),
      ).toThrow(InvalidBaseUnitCostError);
    });

    it("rejects negative conversion factor", () => {
      expect(() =>
        convertUnitCostToBaseUnit({
          unitCost: 12_000,
          conversionFactor: -3,
        }),
      ).toThrow(InvalidBaseUnitCostError);
    });

    it("rejects NaN conversion factor", () => {
      expect(() =>
        convertUnitCostToBaseUnit({
          unitCost: 12_000,
          conversionFactor: Number.NaN,
        }),
      ).toThrow(InvalidBaseUnitCostError);
    });

    it("rejects Infinity conversion factor", () => {
      expect(() =>
        convertUnitCostToBaseUnit({
          unitCost: 12_000,
          conversionFactor: Number.POSITIVE_INFINITY,
        }),
      ).toThrow(InvalidBaseUnitCostError);
    });

    it("rejects a result that cannot be represented safely with MONEY_SCALE", () => {
      expect(() =>
        convertUnitCostToBaseUnit({
          unitCost: Number.MAX_SAFE_INTEGER,
          conversionFactor: 0.1,
        }),
      ).toThrow(InvalidBaseUnitCostError);
    });

    it("preserves the exact mathematical base-unit cost without rounding", () => {
      const unitCost = 9_000;
      const conversionFactor = 3;

      const result = convertUnitCostToBaseUnit({
        unitCost,
        conversionFactor,
      });

      expect(result).toBe(3_000);

      // Explicitly prove that no rounding was introduced.
      expect(result).not.toBe(Math.round(unitCost / conversionFactor) + 1);
    });
  });
});
