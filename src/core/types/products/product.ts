export interface ProductUnitData {
  id: string;
  unitId: string;
  barcode?: string;
  conversionFactor: number;
  salePrice: number;
  purchasePrice: number;
}

export interface CreateProductUnitInput {
  unitId: string;
  barcode?: string;
  conversionFactor: number;
  salePrice: number;
  purchasePrice: number;
}

export interface UpdateProductUnitInput {
  id?: string;
  unitId: string;
  barcode?: string;
  conversionFactor: number;
  salePrice: number;
  purchasePrice: number;
}

export interface CreateProductInput {
  categoryId?: string;

  name: string;
  sku?: string;

  minStock: number;
  isActive: boolean;

  // ✅ اختيارية — تُحلّ تلقائياً من التصنيف أو الإعدادات
  inventoryAccountId?: string;
  salesAccountId?: string;
  cogsAccountId?: string;

  units: CreateProductUnitInput[];
}

export interface UpdateProductInput {
  categoryId?: string;

  name: string;
  sku?: string;

  minStock: number;
  isActive: boolean;

  // ✅ اختيارية — تُحلّ تلقائياً من التصنيف أو الإعدادات
  inventoryAccountId?: string;
  salesAccountId?: string;
  cogsAccountId?: string;

  units: UpdateProductUnitInput[];
}

export interface ProductData {
  id: string;
  categoryId?: string;

  name: string;
  sku?: string;

  lastPurchaseCost: number;
  minStock: number;
  isActive: boolean;

  // ✅ اختيارية — تُحلّ تلقائياً من التصنيف أو الإعدادات
  inventoryAccountId?: string;
  salesAccountId?: string;
  cogsAccountId?: string;

  units: ProductUnitData[];

  createdAt: number;
  updatedAt: number;
}

export interface CreateProductUnitInput {
  unitId: string;
  barcode?: string;
  conversionFactor: number;
  salePrice: number;
  purchasePrice: number;
}

export interface CreateProductInput {
  categoryId?: string;

  name: string;
  sku?: string;

  minStock: number;
  isActive: boolean;

  // ✅ اختيارية — تُحلّ تلقائياً من التصنيف أو الإعدادات
  inventoryAccountId?: string;
  salesAccountId?: string;
  cogsAccountId?: string;

  units: CreateProductUnitInput[];
}

export interface UpdateProductInput extends CreateProductInput {}

export interface ProductSearchInput {
  search?: string;
  categoryId?: string;
  activeOnly?: boolean;
  page: number;
  pageSize: number;
}

export interface ProductSearchResult {
  productId: string;
  name: string;
  sku?: string;

  pieceUnitId: string;
  pieceUnitName: string;

  salePrice: number;
}

export interface ProductUnitOption {
  productUnitId: string;
  unitId: string;
  unitName: string;

  conversionFactor: number;

  salePrice: number;
  purchasePrice: number;

  barcode?: string;
}

export interface BarcodeProductResult {
  product: ProductData;
  unit: ProductUnitOption;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

