// hooks/useProductDetail.ts
import { useState, useEffect } from "react";
import { database } from "@core/database";
import Product from "@core/database/models/Product";
import ProductUnit from "@core/database/models/ProductUnit";
import ProductBatch from "@core/database/models/ProductBatch";
import StockMovement from "@core/database/models/StockMovement";
import { Q } from "@nozbe/watermelondb";
import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";

interface ProductDetailData {
  product: Product | null;
  stock: number;
  defaultUnit?: ProductUnit;
  batches: ProductBatch[];
  recentMovements: StockMovement[];
  isLoading: boolean;
  error?: Error;
}

export function useProductDetail(productId: string): ProductDetailData {
  const [data, setData] = useState<ProductDetailData>({
    product: null,
    stock: 0,
    defaultUnit: undefined,
    batches: [],
    recentMovements: [],
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;
    const subscriptions: Array<{ unsubscribe: () => void }> = []; // ✅ استخدم const

    const loadData = async () => {
      try {
        const productsCollection = database.get<Product>("products");
        const productUnitsCollection =
          database.get<ProductUnit>("product_units");
        const batchesCollection = database.get<ProductBatch>("product_batches");
        const movementsCollection =
          database.get<StockMovement>("stock_movements");

        // ✅ 1. اشتراك في المنتج (طريقة صحيحة)
        const productQuery = productsCollection.query(Q.where("id", productId));
        const productSub = productQuery.observe().subscribe({
          next: (results) => {
            if (isMounted && results.length > 0) {
              setData((prev) => ({ ...prev, product: results[0] }));
            }
          },
          error: (err) => {
            if (isMounted) {
              setData((prev) => ({ ...prev, error: err, isLoading: false }));
            }
          },
        });
        subscriptions.push(productSub);

        // ✅ 2. اشتراك في الرصيد الحالي
        const stockSub = inventoryRepository
          .observeProductStock(productId)
          .subscribe({
            next: (stock) => {
              if (isMounted) {
                setData((prev) => ({ ...prev, stock }));
              }
            },
          });
        subscriptions.push(stockSub);

        // ✅ 3. جلب الوحدة الافتراضية (للمرة الأولى)
        const units = await productUnitsCollection
          .query(
            Q.where("product_id", productId),
            Q.sortBy("created_at", Q.asc),
          )
          .fetch();
        const defaultUnit = units[0];

        // ✅ 4. جلب الدفعات (للمرة الأولى)
        const batches = await batchesCollection
          .query(
            Q.where("product_id", productId),
            Q.sortBy("created_at", Q.desc),
          )
          .fetch();

        // ✅ 5. جلب آخر 10 حركات (للمرة الأولى)
        const movements = await movementsCollection
          .query(
            Q.where("product_id", productId),
            Q.sortBy("movement_date", Q.desc),
            Q.take(10),
          )
          .fetch();

        if (isMounted) {
          setData((prev) => ({
            ...prev,
            defaultUnit,
            batches,
            recentMovements: movements,
            isLoading: false,
          }));
        }
      } catch (err) {
        if (isMounted) {
          setData((prev) => ({
            ...prev,
            error: err as Error,
            isLoading: false,
          }));
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
  }, [productId]);

  return data;
}
