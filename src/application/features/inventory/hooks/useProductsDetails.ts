import { useState, useEffect } from "react";
import Product from "@database/models/Product";
import ProductUnit from "@database/models/ProductUnit";
import ProductBatch from "@database/models/ProductBatch";
import StockMovement from "@database/models/StockMovement";
import { Q } from "@nozbe/watermelondb";
import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";
import { database } from "src/database";

interface ProductDetailData {
  product: Product | null;
  stock: number;
  defaultUnit?: ProductUnit;
  defaultUnitName?: string;
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
    defaultUnitName: undefined,
    batches: [],
    recentMovements: [],
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;
    const subscriptions: Array<{ unsubscribe: () => void }> = [];

    const loadData = async () => {
      try {
        const productsCollection = database.get<Product>("products");
        const productUnitsCollection = database.get<ProductUnit>("product_units");
        const batchesCollection = database.get<ProductBatch>("product_batches");
        const movementsCollection = database.get<StockMovement>("stock_movements");

        const productSub = productsCollection
          .query(Q.where("id", productId))
          .observe()
          .subscribe({
            next: (results: string | any[]) => {
              if (isMounted) {
                setData((prev) => ({
                  ...prev,
                  product: results.length > 0 ? results[0] : null,
                }));
              }
            },
            error: (err: any) => {
              if (isMounted) {
                setData((prev) => ({ ...prev, error: err, isLoading: false }));
              }
            },
          });
        subscriptions.push(productSub);

        const stockSub = inventoryRepository
          .observeProductStock(productId)
          .subscribe({
            next: (stock: any) => {
              if (isMounted) setData((prev) => ({ ...prev, stock }));
            },
          });
        subscriptions.push(stockSub);

        const units = await productUnitsCollection
          .query(Q.where("product_id", productId), Q.sortBy("created_at", Q.asc))
          .fetch();
        const defaultUnit = units[0];

        // ✅ جلب اسم الوحدة صراحة
        let defaultUnitName: string | undefined = undefined;
        if (defaultUnit?.unitId) {
          try {
            const unitModel = await database.get("units").find(defaultUnit.unitId);
            defaultUnitName = (unitModel as any).name;
          } catch {
            defaultUnitName = undefined;
          }
        }

        const batches = await batchesCollection
          .query(Q.where("product_id", productId), Q.sortBy("created_at", Q.desc))
          .fetch();

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
            defaultUnitName,
            batches,
            recentMovements: movements,
            isLoading: false,
          }));
        }
      } catch (err) {
        if (isMounted) {
          setData((prev) => ({ ...prev, error: err as Error, isLoading: false }));
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


