import { database } from "src/database";
import Product from "src/database/models/Product";
import ProductUnit from "src/database/models/ProductUnit";

export const seedProductUnits = async () => {
  try {
    const productsCollection = database.get<Product>("products");
    const unitsCollection = database.get<ProductUnit>("product_units");

    const products = await productsCollection.query().fetch();

    if (products.length === 0) {
      console.log("No products found to seed units for.");
      return;
    }

    await database.write(async () => {
      for (const product of products) {
        // التحقق ما إذا كان للمنتج وحدات مسبقاً
        const existingUnits = await unitsCollection.query().fetch();

        const hasUnits = existingUnits.some((u) => u.productId === product.id);

        if (!hasUnits) {
          // إنشاء وحدة أساسية مطابقة لهيكل النموذج لديك
          await unitsCollection.create((unit) => {
            unit.productId = product.id;
            unit.unitId = "1"; // استبدلها بالمعرف الصحيح أو افتراضي إذا وجد جدول وحدات عام
            unit.conversionFactor = 1;
            unit.salePrice = 100;
            unit.purchasePrice = 50;
            unit.barcode = null;
          });
        }
      }
    });

    console.log("Product units seeded successfully based on actual schema!");
  } catch (error) {
    console.error("Error seeding product units:", error);
  }
};

/** Delete product and category records explicitly from the current schema. */
export const clearAllProducts = async (): Promise<void> => {
  const products = database.get<Product>(Product.table);
  await database.write(async () => {
    const rows = await products.query().fetch();
    await database.batch(...rows.map((row) => row.prepareDestroyPermanently()));
  });
};
