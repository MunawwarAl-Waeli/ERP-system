// hooks/useProductsSearch.ts
import { useState, useEffect } from "react";
import { database } from "@core/database";
import Product from "@core/database/models/Product";
import ProductUnit from "@core/database/models/ProductUnit";
import { Q } from "@nozbe/watermelondb";

// ✅ 1. التعديل هنا: فصل المنتج عن الوحدات لضمان عدم فقدان خصائص الموديل
export interface ProductWithUnits {
  product: Product;
  units: ProductUnit[];
}

export function useProductsSearch(searchTerm: string) {
  const [products, setProducts] = useState<ProductWithUnits[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const productsCollection = database.get<Product>("products");
    const unitsCollection = database.get<ProductUnit>("product_units");

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

        // جلب الوحدات لكل منتج
        const productsWithUnits: ProductWithUnits[] = await Promise.all(
          productsList.map(async (product) => {
            const units = await unitsCollection
              .query(Q.where("product_id", product.id))
              .fetch();

            // ✅ 2. التعديل هنا: إرجاع المنتج الأصلي مع الوحدات بدون Spread Operator
            return { product, units };
          }),
        );

        if (isMounted) {
          setProducts(productsWithUnits);
          setIsLoading(false);
        }
      } catch (error) {
        console.error(error);
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
