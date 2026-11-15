/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, SetStateAction } from "react";
import Product from "@database/models/Product";
import Category from "@database/models/Category";
import { Q } from "@nozbe/watermelondb";
import { useDebounce } from "@shared/hooks/useDebounce";
import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";
import { database } from "src/database";

export interface ProductWithStock extends Product {
  stock: number;
}

export function useProductsWithStock(
  searchQuery: string = "",
  categoryId?: string,
) {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const productsCollection = database.get<Product>("products");
    let query = productsCollection.query(Q.where("is_active", true));

    if (debouncedSearch.trim()) {
      query = query.extend(
        Q.where("name", Q.like(`%${Q.sanitizeLikeString(debouncedSearch)}%`)),
      );
    }

    if (categoryId) {
      query = query.extend(Q.where("category_id", categoryId));
    }

    const subscription = query.observe().subscribe(async (rawProducts: any[]) => {
      try {
        const productsWithStock = await Promise.all(
          rawProducts.map(async (product: { id: string; }) => {
            const stock = await inventoryRepository.getProductStock(product.id);
            return Object.assign(product, { stock }) as ProductWithStock;
          }),
        );

        if (isMounted) {
          setProducts(productsWithStock);
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [debouncedSearch, categoryId]);

  return { products, isLoading, error };
}

export const useProductStock = (productId: string) => {
  const [stock, setStock] = useState(0);

  useEffect(() => {
    const subscription = inventoryRepository
      .observeProductStock(productId)
      .subscribe((value: SetStateAction<number>) => setStock(value));
    return () => subscription.unsubscribe();
  }, [productId]);

  return stock;
};

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    const categoriesCollection = database.get<Category>("categories");
    const subscription = categoriesCollection
      .query(Q.sortBy("name", Q.asc))
      .observe()
      .subscribe({
        next: (data: SetStateAction<Category[]>) => {
          if (isMounted) { setCategories(data); setIsLoading(false); }
        },
        error: (err: SetStateAction<Error | null>) => {
          if (isMounted) { setError(err); setIsLoading(false); }
        },
      });
    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

  return { categories, isLoading, error };
}
