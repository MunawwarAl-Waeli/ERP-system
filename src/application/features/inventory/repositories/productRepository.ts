import {
  BarcodeProductResult,
  CreateProductInput,
  PaginatedResult,
  ProductData,
  ProductSearchInput,
  ProductSearchResult,
  ProductUnitData,
  UpdateProductInput,
} from "@core/types/products/product";
import { database } from "src/database";
import Product from "src/database/models/Product";
import Category from "src/database/models/Category";
import { Q } from "@nozbe/watermelondb";
import { WatermelonProductRepository } from "@infrastructure/watermelon/repositories/WatermelonProductRepository";

export interface ProductRepository {
  getById(
    id: string,
  ): Promise<ProductData | null>;

  getBySku(
    sku: string,
  ): Promise<ProductData | null>;

  getByBarcode(
    barcode: string,
  ): Promise<BarcodeProductResult | null>;

  search(
    input: ProductSearchInput,
  ): Promise<PaginatedResult<ProductSearchResult>>;

  getUnitById(
    productId: string,
    productUnitId: string,
  ): Promise<ProductUnitData | null>;

  getUnitsByProduct(
    productId: string,
  ): Promise<ProductUnitData[]>;

  create(
    input: CreateProductInput,
  ): Promise<ProductData>;

  update(
    id: string,
    input: UpdateProductInput,
  ): Promise<ProductData>;
}

const productCore = new WatermelonProductRepository(database);
const products = database.get<Product>(Product.table);
const categories = database.get<Category>(Category.table);

export const productDataRepository = productCore;
// ✅ إعادة تصدير productCore بسيطة (بدون merge مع المستودع القديم)
export const productRepository = productCore;