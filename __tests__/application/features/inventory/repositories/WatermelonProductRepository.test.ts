import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import { Database, Q, appSchema, tableSchema } from "@nozbe/watermelondb";

import Product from "@database/models/Product";
import ProductUnit from "@database/models/ProductUnit";
import Unit from "@database/models/Unit";
import Category from "@database/models/Category";

import { WatermelonProductRepository } from "@infrastructure/watermelon/repositories/WatermelonProductRepository";

describe("WatermelonProductRepository", () => {
  let database: Database;
  let repository: WatermelonProductRepository;
  let pieceUnit: Unit;
  /**
   * Repository write operations must be executed
   * inside an existing WatermelonDB Writer.
   *
   * IMPORTANT:
   * The repository itself must NOT call database.write().
   * The application UnitOfWork owns the transaction boundary.
   */

  beforeEach(async () => {
    const schema = appSchema({
      version: 1,
      tables: [
        tableSchema({
          name: "products",
          columns: [
            {
              name: "category_id",
              type: "string",
              isOptional: true,
              isIndexed: true,
            },
            {
              name: "name",
              type: "string",
              isIndexed: true,
            },
            {
              name: "sku",
              type: "string",
              isOptional: true,
              isIndexed: true,
            },
            {
              name: "last_purchase_cost",
              type: "number",
            },
            {
              name: "min_stock",
              type: "number",
            },
            {
              name: "is_active",
              type: "boolean",
            },
            {
              name: "inventory_account_id",
              type: "string",
              isIndexed: true,
            },
            {
              name: "sales_account_id",
              type: "string",
              isIndexed: true,
            },
            {
              name: "cogs_account_id",
              type: "string",
              isIndexed: true,
            },
            {
              name: "created_at",
              type: "number",
            },
            {
              name: "updated_at",
              type: "number",
            },
          ],
        }),

        tableSchema({
          name: "product_units",
          columns: [
            {
              name: "product_id",
              type: "string",
              isIndexed: true,
            },
            {
              name: "unit_id",
              type: "string",
              isIndexed: true,
            },
            {
              name: "barcode",
              type: "string",
              isOptional: true,
              isIndexed: true,
            },
            {
              name: "conversion_factor",
              type: "number",
            },
            {
              name: "sale_price",
              type: "number",
            },
            {
              name: "purchase_price",
              type: "number",
            },
            {
              name: "created_at",
              type: "number",
            },
            {
              name: "updated_at",
              type: "number",
            },
          ],
        }),

        tableSchema({
          name: "units",
          columns: [
            {
              name: "code",
              type: "string",
              isIndexed: true,
            },
            {
              name: "name",
              type: "string",
              isIndexed: true,
            },
            {
              name: "created_at",
              type: "number",
            },
            {
              name: "updated_at",
              type: "number",
            },
          ],
        }),

        tableSchema({
          name: "categories",
          columns: [
            {
              name: "name",
              type: "string",
            },
            {
              name: "icon",
              type: "string",
              isOptional: true,
            },
            {
              name: "created_at",
              type: "number",
            },
          ],
        }),
      ],
    });

    const adapter = new LokiJSAdapter({
      schema,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });

    database = new Database({
      adapter,
      modelClasses: [Product, ProductUnit, Unit, Category],
    });

    repository = new WatermelonProductRepository(database);
    await database.write(async () => {
      pieceUnit = await database.get<Unit>("units").create((record) => {
        record.code = "piece";
        record.name = "حبة";
      });
    });
  });
  async function write<T>(work: () => Promise<T>): Promise<T> {
    return database.write(work);
  }
  afterEach(async () => {
    await write(async () => {
      await database.unsafeResetDatabase();
    });
  });

  async function createUnit(code: string, name: string): Promise<Unit> {
    return write(async () => {
      return database.get<Unit>("units").create((unit) => {
        unit.code = code;
        unit.name = name;
      });
    });
  }

  async function createCategory(name: string): Promise<Category> {
    return write(async () => {
      return database.get<Category>("categories").create((category) => {
        category.name = name;
      });
    });
  }

  async function createTestProduct(
    overrides: Partial<{
      categoryId: string;
      name: string;
      sku: string;
      isActive: boolean;
    }> = {},
  ) {
    return write(() =>
      repository.create({
        categoryId: overrides.categoryId,
        name: overrides.name ?? "عصير X",
        sku: overrides.sku ?? "JUICE-X",
        minStock: 10,
        isActive: overrides.isActive ?? true,
        inventoryAccountId: "inventory-account",
        salesAccountId: "sales-account",
        cogsAccountId: "cogs-account",
        units: [
          {
            unitId: pieceUnit.id,
            barcode: "123456789",
            conversionFactor: 1,
            salePrice: 500,
            purchasePrice: 400,
          },
        ],
      }),
    );
  }

  describe("create", () => {
    it("creates a product with its product units", async () => {
      const product = await write(() =>
        repository.create({
          name: "عصير X",
          sku: "JUICE-X",
          minStock: 10,
          isActive: true,
          inventoryAccountId: "inventory-account",
          salesAccountId: "sales-account",
          cogsAccountId: "cogs-account",
          units: [
            {
              unitId: pieceUnit.id,
              barcode: "111111",
              conversionFactor: 1,
              salePrice: 500,
              purchasePrice: 400,
            },
          ],
        }),
      );

      expect(product.name).toBe("عصير X");
      expect(product.sku).toBe("JUICE-X");

      expect(product.categoryId).toBeUndefined();

      expect(product.units).toHaveLength(1);

      expect(product.units[0]).toMatchObject({
        unitId: pieceUnit.id,
        barcode: "111111",
        conversionFactor: 1,
        salePrice: 500,
        purchasePrice: 400,
      });
    });

    it("creates a product with an optional category", async () => {
      const category = await createCategory("مشروبات");

      const product = await createTestProduct({
        categoryId: category.id,
      });

      expect(product.categoryId).toBe(category.id);
    });

    it("allows creating a product without categoryId", async () => {
      const product = await createTestProduct();

      expect(product.categoryId).toBeUndefined();
    });
  });

  describe("getById", () => {
    it("returns the product with all product units", async () => {
      const product = await createTestProduct();

      const result = await repository.getById(product.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(product.id);
      expect(result?.name).toBe("عصير X");
      expect(result?.units).toHaveLength(1);
    });

    it("returns null when product does not exist", async () => {
      const result = await repository.getById("non-existing-product");

      expect(result).toBeNull();
    });
  });

  describe("getBySku", () => {
    it("returns product by exact SKU", async () => {
      await createTestProduct({
        sku: "ABC-100",
      });

      const result = await repository.getBySku("ABC-100");

      expect(result).not.toBeNull();
      expect(result?.sku).toBe("ABC-100");
    });

    it("normalizes SKU before lookup", async () => {
      await createTestProduct({
        sku: "ABC-100",
      });

      const result = await repository.getBySku("  abc-100  ");

      expect(result).not.toBeNull();
      expect(result?.sku).toBe("ABC-100");
    });

    it("returns null when SKU does not exist", async () => {
      const result = await repository.getBySku("NOT-FOUND");

      expect(result).toBeNull();
    });
  });

  describe("getByBarcode", () => {
    it("returns the exact product and matched product unit", async () => {
      const product = await createTestProduct();

      const result = await repository.getByBarcode("123456789");

      expect(result).not.toBeNull();

      expect(result?.product.id).toBe(product.id);

      expect(result?.unit.barcode).toBe("123456789");

      /**
       * productUnitId is the ProductUnit ID,
       * not the Product ID.
       */
      expect(result?.unit.productUnitId).toBe(product.units[0].id);
    });

    it("returns null when barcode does not exist", async () => {
      const result = await repository.getByBarcode("999999999");

      expect(result).toBeNull();
    });

    it("normalizes barcode before lookup", async () => {
      await createTestProduct();

      const result = await repository.getByBarcode(" 123456789 ");

      expect(result).not.toBeNull();

      expect(result?.unit.barcode).toBe("123456789");
    });
  });

  describe("getUnitsByProduct", () => {
    it("returns all units belonging to the product", async () => {
      const cartonUnit = await createUnit("carton", "كرتون");

      const product = await write(() =>
        repository.create({
          name: "عصير X",
          sku: "JUICE-X",
          minStock: 10,
          isActive: true,
          inventoryAccountId: "inventory",
          salesAccountId: "sales",
          cogsAccountId: "cogs",
          units: [
            {
              unitId: pieceUnit.id,
              conversionFactor: 1,
              salePrice: 500,
              purchasePrice: 400,
            },
            {
              unitId: cartonUnit.id,
              conversionFactor: 24,
              salePrice: 12000,
              purchasePrice: 9000,
            },
          ],
        }),
      );

      const units = await repository.getUnitsByProduct(product.id);

      expect(units).toHaveLength(2);

      expect(units.map((unit) => unit.unitId)).toEqual(
        expect.arrayContaining([pieceUnit.id, cartonUnit.id]),
      );
    });
  });

  describe("getUnitById", () => {
    it("returns a unit belonging to the requested product", async () => {
      const product = await createTestProduct();

      const unit = product.units[0];

      const result = await repository.getUnitById(product.id, unit.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(unit.id);
      expect(result?.unitId).toBe(unit.unitId);
    });

    it("returns null when unit belongs to another product", async () => {
      const first = await createTestProduct({
        sku: "FIRST",
      });

      const second = await createTestProduct({
        sku: "SECOND",
      });

      const unit = first.units[0];

      const result = await repository.getUnitById(second.id, unit.id);

      expect(result).toBeNull();
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await createTestProduct({
        name: "عصير برتقال",
        sku: "ORANGE",
      });

      await createTestProduct({
        name: "عصير تفاح",
        sku: "APPLE",
      });

      await createTestProduct({
        name: "مياه معدنية",
        sku: "WATER",
      });

      await createTestProduct({
        name: "منتج غير فعال",
        sku: "INACTIVE",
        isActive: false,
      });
    });

    it("searches by product name", async () => {
      const result = await repository.search({
        search: "برتقال",
        page: 1,
        pageSize: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("عصير برتقال");
    });

    it("searches by SKU", async () => {
      const result = await repository.search({
        search: "APPLE",
        page: 1,
        pageSize: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sku).toBe("APPLE");
    });

    it("does not search by barcode", async () => {
      const result = await repository.search({
        search: "123456789",
        page: 1,
        pageSize: 20,
      });

      expect(result.items).toHaveLength(0);
    });

    it("filters active products", async () => {
      const result = await repository.search({
        activeOnly: true,
        page: 1,
        pageSize: 20,
      });

      expect(result.items.some((item) => item.sku === "INACTIVE")).toBe(false);
    });

    it("includes inactive products when activeOnly is false", async () => {
      const result = await repository.search({
        activeOnly: false,
        page: 1,
        pageSize: 20,
      });

      expect(result.items.some((item) => item.sku === "INACTIVE")).toBe(true);
    });

    it("supports pagination", async () => {
      const page1 = await repository.search({
        page: 1,
        pageSize: 2,
      });

      expect(page1.items).toHaveLength(2);
      expect(page1.hasNextPage).toBe(true);

      const page2 = await repository.search({
        page: 2,
        pageSize: 2,
      });

      expect(page2.items).toHaveLength(2);
      expect(page2.hasNextPage).toBe(false);

      const page1Ids = page1.items.map((item) => item.productId);

      const page2Ids = page2.items.map((item) => item.productId);

      expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
    });

    it("returns piece unit information in search result", async () => {
      const result = await repository.search({
        search: "برتقال",
        page: 1,
        pageSize: 20,
      });

      expect(result.items[0]).toMatchObject({
        name: "عصير برتقال",
        pieceUnitName: "حبة",
        salePrice: 500,
      });
    });

    it("supports category filtering", async () => {
      const category = await createCategory("مشروبات");

      await write(() =>
        repository.create({
          categoryId: category.id,
          name: "مشروب مصنف",
          sku: "CATEGORY-1",
          minStock: 5,
          isActive: true,
          inventoryAccountId: "inventory",
          salesAccountId: "sales",
          cogsAccountId: "cogs",
          units: [
            {
              unitId: pieceUnit.id,
              conversionFactor: 1,
              salePrice: 100,
              purchasePrice: 80,
            },
          ],
        }),
      );

      const result = await repository.search({
        categoryId: category.id,
        page: 1,
        pageSize: 20,
      });

      expect(result.items).toHaveLength(1);

      expect(result.items[0].name).toBe("مشروب مصنف");
    });
  });
//   it("DEBUG: tests Arabic Q.like directly", async () => {
//     const result = await database
//       .get<Product>("products")
//       .query(Q.where("name", Q.like(`%${Q.sanitizeLikeString("برتقال")}%`)))
//       .fetch();

//     console.log(
//       "DIRECT Q.LIKE RESULT:",
//       result.map((product) => product.name),
//     );

//     expect(result).toHaveLength(1);
//     expect(result[0].name).toBe("عصير برتقال");
//   });
  describe("update", () => {
    it("updates product fields", async () => {
      const product = await createTestProduct();

      const updated = await write(() =>
        repository.update(product.id, {
          categoryId: undefined,
          name: "عصير X الجديد",
          sku: "JUICE-NEW",
          minStock: 20,
          isActive: false,
          inventoryAccountId: "inventory-new",
          salesAccountId: "sales-new",
          cogsAccountId: "cogs-new",
          units: [
            {
              id: product.units[0].id,
              unitId: product.units[0].unitId,
              barcode: "999999",
              conversionFactor: 1,
              salePrice: 600,
              purchasePrice: 450,
            },
          ],
        }),
      );

      expect(updated.name).toBe("عصير X الجديد");

      expect(updated.sku).toBe("JUICE-NEW");

      expect(updated.minStock).toBe(20);

      expect(updated.isActive).toBe(false);

      expect(updated.inventoryAccountId).toBe("inventory-new");

      expect(updated.units).toHaveLength(1);

      expect(updated.units[0]).toMatchObject({
        id: product.units[0].id,
        barcode: "999999",
        salePrice: 600,
        purchasePrice: 450,
      });
    });

    it("updates an existing product unit using its id", async () => {
      const product = await createTestProduct();

      const originalUnit = product.units[0];

      const updated = await write(() =>
        repository.update(product.id, {
          name: product.name,
          sku: product.sku,
          minStock: product.minStock,
          isActive: product.isActive,
          inventoryAccountId: product.inventoryAccountId,
          salesAccountId: product.salesAccountId,
          cogsAccountId: product.cogsAccountId,
          units: [
            {
              id: originalUnit.id,
              unitId: originalUnit.unitId,
              barcode: "UPDATED-BARCODE",
              conversionFactor: 1,
              salePrice: 700,
              purchasePrice: 550,
            },
          ],
        }),
      );

      expect(updated.units).toHaveLength(1);

      expect(updated.units[0].id).toBe(originalUnit.id);

      expect(updated.units[0].barcode).toBe("UPDATED-BARCODE");

      expect(updated.units[0].salePrice).toBe(700);
    });

    it("creates a new product unit when id is omitted", async () => {
      const product = await createTestProduct();

      const cartonUnit = await createUnit("carton", "كرتون");

      const updated = await write(() =>
        repository.update(product.id, {
          name: product.name,
          sku: product.sku,
          minStock: product.minStock,
          isActive: product.isActive,
          inventoryAccountId: product.inventoryAccountId,
          salesAccountId: product.salesAccountId,
          cogsAccountId: product.cogsAccountId,
          units: [
            {
              id: product.units[0].id,
              unitId: product.units[0].unitId,
              conversionFactor: 1,
              salePrice: 500,
              purchasePrice: 400,
            },
            {
              unitId: cartonUnit.id,
              conversionFactor: 24,
              salePrice: 12000,
              purchasePrice: 9000,
            },
          ],
        }),
      );

      expect(updated.units).toHaveLength(2);

      expect(updated.units.some((unit) => unit.unitId === cartonUnit.id)).toBe(
        true,
      );
    });

    it("does not delete existing units omitted from update", async () => {
      const cartonUnit = await createUnit("carton", "كرتون");

      const product = await write(() =>
        repository.create({
          name: "عصير X",
          sku: "MULTI-UNIT",
          minStock: 10,
          isActive: true,
          inventoryAccountId: "inventory",
          salesAccountId: "sales",
          cogsAccountId: "cogs",
          units: [
            {
              unitId: pieceUnit.id,
              conversionFactor: 1,
              salePrice: 500,
              purchasePrice: 400,
            },
            {
              unitId: cartonUnit.id,
              conversionFactor: 24,
              salePrice: 12000,
              purchasePrice: 9000,
            },
          ],
        }),
      );

      const piece = product.units.find((unit) => unit.unitId === pieceUnit.id);

      expect(piece).toBeDefined();

      const updated = await write(() =>
        repository.update(product.id, {
          name: product.name,
          sku: product.sku,
          minStock: product.minStock,
          isActive: product.isActive,
          inventoryAccountId: product.inventoryAccountId,
          salesAccountId: product.salesAccountId,
          cogsAccountId: product.cogsAccountId,
          units: [
            {
              id: piece!.id,
              unitId: pieceUnit.id,
              conversionFactor: 1,
              salePrice: 550,
              purchasePrice: 420,
            },
          ],
        }),
      );

      expect(updated.units).toHaveLength(2);

      expect(updated.units.some((unit) => unit.unitId === cartonUnit.id)).toBe(
        true,
      );
    });

    it("rejects a product unit id belonging to another product", async () => {
      const first = await createTestProduct({
        sku: "FIRST",
      });

      const second = await createTestProduct({
        sku: "SECOND",
      });

      await expect(
        write(() =>
          repository.update(second.id, {
            name: second.name,
            sku: second.sku,
            minStock: second.minStock,
            isActive: second.isActive,
            inventoryAccountId: second.inventoryAccountId,
            salesAccountId: second.salesAccountId,
            cogsAccountId: second.cogsAccountId,
            units: [
              {
                id: first.units[0].id,
                unitId: first.units[0].unitId,
                conversionFactor: 1,
                salePrice: 500,
                purchasePrice: 400,
              },
            ],
          }),
        ),
      ).rejects.toThrow(`does not belong to product "${second.id}"`);
    });
  });
});
