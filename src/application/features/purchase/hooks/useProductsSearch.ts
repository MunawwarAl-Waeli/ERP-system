// src/features/purchases/hooks/useProductsSearch.ts
import { useState, useEffect } from "react";
import { database } from "src/database";
import Product from "src/database/models/Product";
import ProductUnit from "src/database/models/ProductUnit";
import Unit from "src/database/models/Unit"; // تأكد أن المسار صحيح
import { Q } from "@nozbe/watermelondb";

// ✅ تعريف شكل البيانات الجديد الذي ستراه الواجهة
export interface ProductUnitData {
  id: string; // ID الخاص بـ ProductUnit (يُستخدم في الفاتورة)
  unitId: string; // ID الخاص بالوحدة الأساسية
  unitName: string; // ✅ اسم الوحدة الحقيقي (كرتونة، قطعة، إلخ)
  conversionFactor: number;
  salePrice: number;
  purchasePrice: number;
  barcode?: string;
  originalModel: ProductUnit;
}

export interface ProductWithUnits {
  product: Product;
  units: ProductUnitData[];
}

export function useProductsSearch(searchTerm: string) {
  const [products, setProducts] = useState<ProductWithUnits[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const productsCollection = database.get<Product>("products");
    const productUnitsCollection = database.get<ProductUnit>("product_units");
    const masterUnitsCollection = database.get<Unit>("units");

    const loadProducts = async () => {
      try {
        let query = productsCollection.query(Q.where("is_active", true));

        if (searchTerm.trim()) {
          query = query.extend(
            Q.or(
              Q.where("name", Q.like(`%${Q.sanitizeLikeString(searchTerm)}%`)),
              Q.where("sku", Q.like(`%${Q.sanitizeLikeString(searchTerm)}%`)),
            ),
          );
        }

        const productsList = await query.fetch();

        const productsWithUnits: ProductWithUnits[] = await Promise.all(
          productsList.map(async (product: { id: any }) => {
            // 1. جلب وحدات المنتج (ProductUnit)
            const productUnits = await productUnitsCollection
              .query(Q.where("product_id", product.id))
              .fetch();

            if (productUnits.length === 0) {
              return { product, units: [] };
            }

            // 2. استخراج كل الـ unitIds لجلب أسمائها دفعة واحدة (تحسين للأداء)
            const unitIds = productUnits.map(
              (pu: { unitId: any }) => pu.unitId,
            );

            // 3. جلب الوحدات الأساسية (Unit) من جدول units
            const masterUnits = await masterUnitsCollection
              .query(Q.where("id", Q.oneOf(unitIds)))
              .fetch();

            // 4. عمل خريطة (Map) للبحث السريع بالـ ID
            // السطر القديم:
            // const unitMap = new Map(masterUnits.map((u) => [u.id, u]));

            // السطر الجديد (مع تحديد النوع):
            const unitMap = new Map<string, Unit>(
              masterUnits.map((u: Unit) => [u.id, u] as [string, Unit]),
            );

            // 5. دمج البيانات
            const unitsData: ProductUnitData[] = productUnits.map((pu: { unitId: string; id: any; conversionFactor: any; salePrice: any; purchasePrice: any; barcode: any; }) => {
              const masterUnit = unitMap.get(pu.unitId);

              return {
                id: pu.id,
                unitId: pu.unitId,
                unitName: masterUnit ? masterUnit.name : "وحدة",
                conversionFactor: pu.conversionFactor,
                salePrice: pu.salePrice,
                purchasePrice: pu.purchasePrice,
                barcode: pu.barcode,
                originalModel: pu,
              };
            });

            return { product, units: unitsData };
          }),
        );

        if (isMounted) {
          setProducts(productsWithUnits);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading products:", error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [searchTerm]);

  return { products, isLoading };
}
