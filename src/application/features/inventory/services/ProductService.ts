import { ProductRepository } from "@application/features/inventory/repositories/productRepository";
import { UnitRepository } from "@application/features/inventory/repositories/UnitRepository";
import { UnitOfWork } from "@application/transactions/UnitOfWork";

import {
  CreateProductInput,
  PaginatedResult,
  ProductData,
  ProductSearchInput,
  ProductSearchResult,
  UpdateProductInput,
} from "@core/types/products/product";

import {
  InvalidProductError,
  ProductAlreadyExistsError,
  ProductNotFoundError,
  ProductUnitAlreadyExistsError,
} from "@core/errors/inventory/ProductErrors";

import { UNIT_CODES } from "@core/constants";
import { database } from "src/database";

export interface ProductService {
  create(input: CreateProductInput): Promise<ProductData>;
  update(id: string, input: UpdateProductInput): Promise<ProductData>;
  deactivate(id: string): Promise<ProductData>;
  getById(id: string): Promise<ProductData | null>;
  getBySku(sku: string): Promise<ProductData | null>;
  search(
    input: ProductSearchInput,
  ): Promise<PaginatedResult<ProductSearchResult>>;
}

export interface ProductServiceDependencies {
  unitOfWork: UnitOfWork;
  productRepository: ProductRepository;
  unitRepository: UnitRepository;
  accountingSettingRepository: {
    get(): Promise<{
      inventoryDefaultAccountId?: string;
      salesDefaultAccountId?: string;
      cogsDefaultAccountId?: string;
    } | null>;
  };
}

export class DefaultProductService implements ProductService {
  constructor(private readonly dependencies: ProductServiceDependencies) {}

  async create(input: CreateProductInput): Promise<ProductData> {
    const normalized = this.normalizeInput(input);

    this.validateInput(normalized);

    return this.dependencies.unitOfWork.execute(async () => {
      await this.validateUniqueSku(normalized.sku);

      await this.validateUnits(normalized.units);

      await this.validateBarcodes(normalized.units);

      try {
        return await this.dependencies.productRepository.create(normalized);
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
          if (error.message.includes("sku")) {
            throw new ProductAlreadyExistsError(
              normalized.sku ? `Product SKU "${normalized.sku}" already exists.` : "A product with empty SKU already exists."
            );
          }
          if (error.message.includes("barcode")) {
            throw new ProductUnitAlreadyExistsError("A barcode in this product is already used elsewhere.");
          }
        }
        throw error;
      }
    });
  }

  async update(id: string, input: UpdateProductInput): Promise<ProductData> {
    const normalized = this.normalizeInput(input);

    this.validateInput(normalized);

    return this.dependencies.unitOfWork.execute(async () => {
      const current = await this.dependencies.productRepository.getById(id);

      if (!current) {
        throw new ProductNotFoundError();
      }

      await this.validateUniqueSku(normalized.sku, id);

      await this.validateUnits(normalized.units);

      await this.validateBarcodes(normalized.units);

      try {
        return await this.dependencies.productRepository.update(id, normalized);
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
          if (error.message.includes("sku")) {
            throw new ProductAlreadyExistsError(
              normalized.sku ? `Product SKU "${normalized.sku}" already exists.` : "A product with empty SKU already exists."
            );
          }
          if (error.message.includes("barcode")) {
            throw new ProductUnitAlreadyExistsError("A barcode in this product is already used elsewhere.");
          }
        }
        throw error;
      }
    });
  }

  async deactivate(id: string): Promise<ProductData> {
    return this.dependencies.unitOfWork.execute(async () => {
      const current = await this.dependencies.productRepository.getById(id);
      if (!current) {
        throw new ProductNotFoundError();
      }
      return this.dependencies.productRepository.update(id, {
        ...current,
        isActive: false,
      } as UpdateProductInput);
    });
  }

  async getById(id: string): Promise<ProductData | null> {
    return this.dependencies.productRepository.getById(id);
  }

  async getBySku(sku: string): Promise<ProductData | null> {
    const normalizedSku = this.normalizeSku(sku);

    if (!normalizedSku) {
      return null;
    }

    return this.dependencies.productRepository.getBySku(normalizedSku);
  }

  async search(
    input: ProductSearchInput,
  ): Promise<PaginatedResult<ProductSearchResult>> {
    this.validatePagination(input);

    const normalizedInput: ProductSearchInput = {
      ...input,
      search: input.search?.trim() || undefined,
    };

    return this.dependencies.productRepository.search(normalizedInput);
  }

  private async validateUniqueSku(
    sku?: string,
    currentProductId?: string,
  ): Promise<void> {
    if (!sku) {
      return;
    }

    const existing = await this.dependencies.productRepository.getBySku(sku);

    if (existing && existing.id !== currentProductId) {
      throw new ProductAlreadyExistsError(
        `Product SKU "${sku}" already exists.`,
      );
    }
  }

  private async validateUnits(
    units: CreateProductInput["units"],
  ): Promise<void> {
    if (units.length === 0) {
      throw new InvalidProductError("Product must have at least one unit.");
    }

    const unitIds = new Set<string>();

    let hasPiece = false;

    for (const productUnit of units) {
      if (unitIds.has(productUnit.unitId)) {
        throw new ProductUnitAlreadyExistsError(
          "The same unit cannot be added to a product more than once.",
        );
      }

      unitIds.add(productUnit.unitId);

      if (
        !Number.isInteger(productUnit.conversionFactor) ||
        productUnit.conversionFactor <= 0
      ) {
        throw new InvalidProductError(
          "Conversion factor must be a positive whole number.",
        );
      }

      if (
        !Number.isFinite(productUnit.salePrice) ||
        productUnit.salePrice < 0
      ) {
        throw new InvalidProductError(
          "Sale price must be a finite number greater than or equal to zero.",
        );
      }

      if (
        !Number.isFinite(productUnit.purchasePrice) ||
        productUnit.purchasePrice < 0
      ) {
        throw new InvalidProductError(
          "Purchase price must be a finite number greater than or equal to zero.",
        );
      }

      const unit = await this.dependencies.unitRepository.getById(
        productUnit.unitId,
      );

      if (!unit) {
        throw new InvalidProductError(
          `Unit "${productUnit.unitId}" does not exist.`,
        );
      }

      if (unit.code === UNIT_CODES.PIECE) {
        if (hasPiece) {
          throw new ProductUnitAlreadyExistsError(
            "A product can have only one piece unit.",
          );
        }

        hasPiece = true;

        if (productUnit.conversionFactor !== 1) {
          throw new InvalidProductError(
            "The piece unit must have conversion factor 1.",
          );
        }
      }
    }

    if (!hasPiece) {
      throw new InvalidProductError("Every product must have a piece unit.");
    }
  }

  private async validateBarcodes(
    units: CreateProductInput["units"],
  ): Promise<void> {
    const barcodes = new Set<string>();

    for (const productUnit of units) {
      const barcode = productUnit.barcode;

      if (!barcode) {
        continue;
      }

      if (barcodes.has(barcode)) {
        throw new ProductUnitAlreadyExistsError(
          `Barcode "${barcode}" is duplicated in the same product.`,
        );
      }

      barcodes.add(barcode);

      const existing = await this.dependencies.productRepository.getByBarcode(
        barcode,
      );

      if (!existing) {
        continue;
      }

      if (productUnit.unitId && existing.unit.productUnitId === productUnit.unitId) {
        continue;
      }

      throw new ProductUnitAlreadyExistsError(
        `Barcode "${barcode}" already exists.`,
      );
    }
  }

  private async resolveAccounts(input: CreateProductInput): Promise<{
    inventoryAccountId: string;
    salesAccountId: string;
    cogsAccountId: string;
  }> {
    // 1. المستخدم وفّر الحسابات صراحة (backward compat) → نستخدمها
    if (input.inventoryAccountId && input.salesAccountId && input.cogsAccountId) {
      return {
        inventoryAccountId: input.inventoryAccountId,
        salesAccountId: input.salesAccountId,
        cogsAccountId: input.cogsAccountId,
      };
    }

    // 2. من التصنيف
    if (input.categoryId) {
      try {
        const cat = await database.get("categories").find(input.categoryId) as any;
        if (cat?.inventoryAccountId && cat?.salesAccountId && cat?.cogsAccountId) {
          return {
            inventoryAccountId: cat.inventoryAccountId,
            salesAccountId: cat.salesAccountId,
            cogsAccountId: cat.cogsAccountId,
          };
        }
      } catch {
        // التصنيف غير موجود → نكمل
      }
    }

    // 3. من الإعدادات الافتراضية
    try {
      const settings = await this.dependencies.accountingSettingRepository.get();
      if (
        settings?.inventoryDefaultAccountId &&
        settings?.salesDefaultAccountId &&
        settings?.cogsDefaultAccountId
      ) {
        return {
          inventoryAccountId: settings.inventoryDefaultAccountId,
          salesAccountId: settings.salesDefaultAccountId,
          cogsAccountId: settings.cogsDefaultAccountId,
        };
      }
    } catch {
      // تجاهل
    }

    throw new InvalidProductError(
      "لا يمكن تحديد الحسابات المحاسبية للمنتج. " +
      "يرجى إما تعيين الحسابات على التصنيف، أو ضبطها في الإعدادات المحاسبية الافتراضية.",
    );
  }

  private validateInput(input: CreateProductInput): void {
    if (!input.name.trim()) {
      throw new InvalidProductError("Product name is required.");
    }

    if (!Number.isInteger(input.minStock) || input.minStock < 0) {
      throw new InvalidProductError(
        "Minimum stock must be a non-negative whole number.",
      );
    }

    // الحسابات تُحلّ تلقائياً في resolveAccounts
  }

  private normalizeInput(
    input: CreateProductInput | UpdateProductInput,
  ): CreateProductInput | UpdateProductInput {
    return {
      ...input,
      name: input.name.trim(),
      sku: this.normalizeSku(input.sku),
      units: input.units.map((unit) => ({
        ...unit,
        barcode: this.normalizeBarcode(unit.barcode),
      })),
    };
  }

  private normalizeSku(sku?: string): string | undefined {
    const normalized = sku?.trim().toUpperCase();

    return normalized || undefined;
  }

  private normalizeBarcode(barcode?: string): string | undefined {
    const normalized = barcode?.trim();

    return normalized || undefined;
  }

  private validatePagination(input: ProductSearchInput): void {
    if (!Number.isInteger(input.page) || input.page < 1) {
      throw new InvalidProductError("Page must be greater than zero.");
    }

    if (!Number.isInteger(input.pageSize) || input.pageSize < 1) {
      throw new InvalidProductError("Page size must be greater than zero.");
    }
  }
}



