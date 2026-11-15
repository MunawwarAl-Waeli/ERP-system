import { Database, Q } from "@nozbe/watermelondb";

import Product from "src/database/models/Product";
import ProductUnit from "src/database/models/ProductUnit";
import Unit from "src/database/models/Unit";

import {
  BarcodeProductResult,
  CreateProductInput,
  PaginatedResult,
  ProductData,
  ProductSearchInput,
  ProductSearchResult,
  ProductUnitData,
  ProductUnitOption,
  UpdateProductInput,
} from "@core/types/products/product";

import type { ProductRepository } from "@application/features/inventory/repositories/productRepository";
import { ProductUnitNotFoundError } from "@core/errors/inventory/ProductErrors";
import { UNIT_CODES } from "@core/constants";

export class WatermelonProductRepository implements ProductRepository {
  constructor(private readonly database: Database) {}

  async getById(id: string): Promise<ProductData | null> {
    const product = await this.database
      .get<Product>("products")
      .find(id)
      .catch(() => null);

    if (!product) {
      return null;
    }

    return this.toProductData(product);
  }

  async getBySku(sku: string): Promise<ProductData | null> {
    const normalizedSku = this.normalizeSku(sku);

    if (!normalizedSku) {
      return null;
    }

    const products = await this.database
      .get<Product>("products")
      .query(Q.where("sku", normalizedSku), Q.take(1))
      .fetch();

    if (products.length === 0) {
      return null;
    }

    return this.toProductData(products[0]);
  }

  async getByBarcode(barcode: string): Promise<BarcodeProductResult | null> {
    const normalizedBarcode = barcode.trim();

    if (!normalizedBarcode) {
      return null;
    }

    const productUnits = await this.database
      .get<ProductUnit>("product_units")
      .query(Q.where("barcode", normalizedBarcode), Q.take(1))
      .fetch();

    if (productUnits.length === 0) {
      return null;
    }

    const productUnit = productUnits[0];

    const product = await this.database
      .get<Product>("products")
      .find(productUnit.productId)
      .catch(() => null);

    if (!product) {
      return null;
    }

    const unit = await this.database
      .get<Unit>("units")
      .find(productUnit.unitId)
      .catch(() => null);

    if (!unit) {
      return null;
    }

    return {
      product: await this.toProductData(product),
      unit: {
        productUnitId: productUnit.id,
        unitId: productUnit.unitId,
        unitName: unit.name,
        conversionFactor: productUnit.conversionFactor,
        salePrice: productUnit.salePrice,
        purchasePrice: productUnit.purchasePrice,
        barcode: productUnit.barcode,
      },
    };
  }

  async search(
    input: ProductSearchInput,
  ): Promise<PaginatedResult<ProductSearchResult>> {
    const page = input.page;
    const pageSize = input.pageSize;

    const offset = (page - 1) * pageSize;

    const queryConditions: any[] = [];

    if (input.categoryId) {
      queryConditions.push(Q.where("category_id", input.categoryId));
    }

    if (input.activeOnly) {
      queryConditions.push(Q.where("is_active", true));
    }

    const search = input.search?.trim();

    if (search) {
      const sanitizedSearch = Q.sanitizeLikeString(search);

      queryConditions.push(
        Q.or(
          Q.where("name", Q.like(`%${sanitizedSearch}%`)),
          Q.where("sku", Q.like(`%${sanitizedSearch}%`)),
        ),
      );
    }

    const products = await this.database
      .get<Product>("products")
      .query(
        ...queryConditions,
        Q.sortBy("name", Q.asc),
        Q.sortBy("id", Q.asc),
        Q.skip(offset),
        Q.take(pageSize + 1),
      )
      .fetch();

    const hasNextPage = products.length > pageSize;

    const pageProducts = hasNextPage ? products.slice(0, pageSize) : products;

    const items = await Promise.all(
      pageProducts.map((product: Product) => this.toProductSearchResult(product)),
    );

    return {
      items,
      page,
      pageSize,
      hasNextPage,
    };
  }

  async getUnitById(
    productId: string,
    productUnitId: string,
  ): Promise<ProductUnitData | null> {
    const productUnit = await this.database
      .get<ProductUnit>("product_units")
      .find(productUnitId)
      .catch(() => null);

    if (!productUnit || productUnit.productId !== productId) {
      return null;
    }

    return this.toProductUnitData(productUnit);
  }

  async getUnitsByProduct(productId: string): Promise<ProductUnitData[]> {
    const units = await this.database
      .get<ProductUnit>("product_units")
      .query(Q.where("product_id", productId))
      .fetch();

    return units.map((unit: ProductUnit) => this.toProductUnitData(unit));
  }

  async create(input: CreateProductInput): Promise<ProductData> {
    const productCollection = this.database.get<Product>("products");

    const productUnitCollection =
      this.database.get<ProductUnit>("product_units");

    const product = await productCollection.create((record: { categoryId: string | undefined; name: string; sku: any; lastPurchaseCost: number; minStock: number; isActive: boolean; inventoryAccountId: string; salesAccountId: string; cogsAccountId: string; }) => {
      record.categoryId = input.categoryId;

      record.name = input.name;

      record.sku = input.sku && input.sku.trim() ? this.normalizeSku(input.sku) : (null as any);

      record.lastPurchaseCost = 0;

      record.minStock = input.minStock;

      record.isActive = input.isActive;

      record.inventoryAccountId = input.inventoryAccountId;

      record.salesAccountId = input.salesAccountId;

      record.cogsAccountId = input.cogsAccountId;
    });

    for (const unitInput of input.units) {
      await productUnitCollection.create((record: { productId: any; unitId: string; barcode: string | undefined; conversionFactor: number; salePrice: number; purchasePrice: number; }) => {
        record.productId = product.id;

        record.unitId = unitInput.unitId;

        record.barcode = unitInput.barcode;

        record.conversionFactor = unitInput.conversionFactor;

        record.salePrice = unitInput.salePrice;

        record.purchasePrice = unitInput.purchasePrice;
      });
    }

    return this.toProductData(product);
  }

  async update(id: string, input: UpdateProductInput): Promise<ProductData> {
    const product = await this.database.get<Product>("products").find(id);

    await product.update((record: { categoryId: string | undefined; name: string; sku: any; minStock: number; isActive: boolean; inventoryAccountId: string; salesAccountId: string; cogsAccountId: string; }) => {
      record.categoryId = input.categoryId;

      record.name = input.name;

      record.sku = input.sku && input.sku.trim() ? this.normalizeSku(input.sku) : (null as any);

      record.minStock = input.minStock;

      record.isActive = input.isActive;

      record.inventoryAccountId = input.inventoryAccountId;

      record.salesAccountId = input.salesAccountId;

      record.cogsAccountId = input.cogsAccountId;
    });

    const productUnits = await this.database
      .get<ProductUnit>("product_units")
      .query(Q.where("product_id", id))
      .fetch();

    const existingUnitsById = new Map<string, ProductUnit>(
      productUnits.map((unit: { id: any; }) => [unit.id, unit]),
    );

    const productUnitCollection =
      this.database.get<ProductUnit>("product_units");

    for (const unitInput of input.units) {
      if (unitInput.id) {
        const existingUnit = existingUnitsById.get(unitInput.id);

        if (!existingUnit) {
          throw new ProductUnitNotFoundError(
            `Product unit "${unitInput.id}" does not belong to product "${id}".`,
          );
        }

        await (existingUnit as any).update((record: any) => {
          record.unitId = unitInput.unitId;

          record.barcode = unitInput.barcode;

          record.conversionFactor = unitInput.conversionFactor;

          record.salePrice = unitInput.salePrice;

          record.purchasePrice = unitInput.purchasePrice;
        });

        continue;
      }

      await productUnitCollection.create((record: { productId: string; unitId: string; barcode: string | undefined; conversionFactor: number; salePrice: number; purchasePrice: number; }) => {
        record.productId = id;

        record.unitId = unitInput.unitId;

        record.barcode = unitInput.barcode;

        record.conversionFactor = unitInput.conversionFactor;

        record.salePrice = unitInput.salePrice;

        record.purchasePrice = unitInput.purchasePrice;
      });
    }

    return this.toProductData(product);
  }

  private async toProductData(product: Product): Promise<ProductData> {
    const units = await this.getUnitsByProduct(product.id);

    return {
      id: product.id,
      categoryId: product.categoryId || undefined,

      name: product.name,
      sku: product.sku || undefined,

      lastPurchaseCost: product.lastPurchaseCost,

      minStock: product.minStock,

      isActive: product.isActive,

      inventoryAccountId: product.inventoryAccountId,

      salesAccountId: product.salesAccountId,

      cogsAccountId: product.cogsAccountId,

      units,

      createdAt: product.createdAt,

      updatedAt: product.updatedAt,
    };
  }

  private async toProductSearchResult(
    product: Product,
  ): Promise<ProductSearchResult> {
    const units = await this.database
      .get<ProductUnit>("product_units")
      .query(Q.where("product_id", product.id))
      .fetch();

    const pieceUnit = await this.findPieceUnit(units);

    /*
     * ProductService guarantees that every
     * valid product has a piece unit.
     *
     * Existing corrupted legacy data must not
     * silently produce a fake result.
     */
    if (!pieceUnit) {
      throw new Error(`Product "${product.id}" does not have a piece unit.`);
    }

    const unit = await this.database.get<Unit>("units").find(pieceUnit.unitId);

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku || undefined,

      pieceUnitId: pieceUnit.id,

      pieceUnitName: unit.name,

      salePrice: pieceUnit.salePrice,
    };
  }

  private async findPieceUnit(
    productUnits: ProductUnit[],
  ): Promise<ProductUnit | null> {
    const pieceUnit = await this.database
      .get<Unit>("units")
      .query(Q.where("code", UNIT_CODES.PIECE), Q.take(1))
      .fetch();

    if (pieceUnit.length === 0) {
      return null;
    }

    return (
      productUnits.find(
        (productUnit) => productUnit.unitId === pieceUnit[0].id,
      ) ?? null
    );
  }

  private toProductUnitData(productUnit: ProductUnit): ProductUnitData {
    return {
      id: productUnit.id,
      unitId: productUnit.unitId,

      barcode: productUnit.barcode || undefined,

      conversionFactor: productUnit.conversionFactor,

      salePrice: productUnit.salePrice,

      purchasePrice: productUnit.purchasePrice,
    };
  }

  private normalizeSku(sku: string): string | undefined {
    const normalized = sku.trim().toUpperCase();

    return normalized || undefined;
  }
}


