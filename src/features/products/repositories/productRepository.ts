// core/repositories/productRepository.ts
import { database } from "@core/database";
import Product from "@core/database/models/Product";
import Category from "@core/database/models/Category";
import { Q } from "@nozbe/watermelondb";
import { ProductFormData, CategoryFormData } from "../schemas/productSchema";
import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";

const productsCollection = database.get<Product>("products");
const categoriesCollection = database.get<Category>("categories");

export const productRepository = {
  // ========================================
  // 1. دوال المراقبة (Observables)
  // ========================================

  /**
   * مراقبة جميع المنتجات النشطة
   */
  observeAll: () =>
    productsCollection
      .query(Q.where("is_active", true), Q.sortBy("name", Q.asc))
      .observe(),

  /**
   * مراقبة منتجات تصنيف معين
   */
  observeByCategory: (categoryId: string) =>
    productsCollection
      .query(
        Q.where("is_active", true),
        Q.where("category_id", categoryId),
        Q.sortBy("name", Q.asc),
      )
      .observe(),

  /**
   * البحث في المنتجات (بالاسم أو SKU)
   */
  search: (searchTerm: string) =>
    productsCollection
      .query(
        Q.where("is_active", true),
        Q.or(
          Q.where("name", Q.like(`%${Q.sanitizeLikeString(searchTerm)}%`)),
          Q.where("sku", Q.like(`%${Q.sanitizeLikeString(searchTerm)}%`)),
        ),
        Q.sortBy("name", Q.asc),
      )
      .observe(),

  /**
   * مراقبة منتج واحد بواسطة ID
   */
  observeById: (id: string) => productsCollection.findAndObserve(id),

  /**
   * جلب منتج واحد بواسطة ID (مرة واحدة)
   */
  getById: (id: string) => productsCollection.find(id),

  // ========================================
  // 2. دوال الكتابة (Write)
  // ========================================

  /**
   * إنشاء منتج جديد (بدون حركة مخزون)
   */
  create: (data: ProductFormData) =>
    database.write(async () => {
      const category = data.categoryId
        ? await categoriesCollection.find(data.categoryId)
        : null;

      return productsCollection.create((product: Product) => {
        product.name = data.name;
        if (category) {
          product.category.set(category);
        }
        product.sku = data.sku || "";
        product.lastPurchaseCost = 0;
        product.minStock = data.minStock || 0;
        product.isActive = true;
      });
    }),

  /**
   * إنشاء منتج مع رصيد افتتاحي (يُنشئ حركة adjustment_in)
   */
  createWithInitialStock: (data: ProductFormData, initialStock: number) =>
    database.write(async () => {
      // 1. إنشاء المنتج
      const product = await productRepository.create(data);

      // 2. إذا كان الرصيد الافتتاحي > 0، تفويض المهمة لـ inventoryRepository
      if (initialStock > 0) {
        await inventoryRepository.adjustStock(product.id, initialStock);
      }

      return product;
    }),

  /**
   * تحديث منتج موجود
   */
  update: (id: string, data: ProductFormData) =>
    database.write(async () => {
      const product = await productsCollection.find(id);
      const category = data.categoryId
        ? await categoriesCollection.find(data.categoryId)
        : null;

      return product.update((p: Product) => {
        p.name = data.name;
        if (category) {
          p.category.set(category);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          p.category.set(null as any);
        }
        p.sku = data.sku || "";
        p.minStock = data.minStock || 0;
      });
    }),

  /**
   * تعطيل المنتج (حذف منطقي)
   */
  deactivate: async (id: string) => {
    const product = await productsCollection.find(id);
    return database.write(() =>
      product.update((p: Product) => {
        p.isActive = false;
      }),
    );
  },

  // ========================================
  // 3. دوال التقارير (تفويض لـ inventoryRepository)
  // ========================================

  /**
   * المنتجات منخفضة المخزون -> استخدام الدالة الموجودة في inventoryRepository
   */
  getLowStockProducts: () => inventoryRepository.getLowStockProducts(),

  /**
   * المنتجات التي نفد مخزونها -> استخدام الدالة الموجودة في inventoryRepository
   */
  getOutOfStockProducts: () => inventoryRepository.getOutOfStockProducts(),

  /**
   * مراقبة حركات منتج معين -> استخدام الدالة الموجودة في inventoryRepository
   */
  getInventoryLogs: (productId: string) =>
    inventoryRepository.observeProductMovements(productId),

  // ========================================
  // 4. دوال التصنيفات (Categories)
  // ========================================

  observeCategories: () =>
    categoriesCollection.query(Q.sortBy("name", Q.asc)).observe(),

  createCategory: (data: CategoryFormData) =>
    database.write(() =>
      categoriesCollection.create((category: Category) => {
        category.name = data.name;
        category.icon = data.icon;
      }),
    ),

  updateCategory: async (id: string, data: CategoryFormData) => {
    const category = await categoriesCollection.find(id);
    return database.write(() =>
      category.update((c: Category) => {
        c.name = data.name;
        c.icon = data.icon;
      }),
    );
  },

  deleteCategory: async (id: string) => {
    const category = await categoriesCollection.find(id);
    return database.write(() => category.destroyPermanently());
  },
};
