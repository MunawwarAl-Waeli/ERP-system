/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import Product from "@core/database/models/Product";
import Category from "@core/database/models/Category";
import { productRepository } from "../repositories/productRepository";
import { useDebounce } from "@shared/hooks/useDebounce";
import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";
import { database } from "@core/database";
import { Q } from "@nozbe/watermelondb";

export interface ProductWithStock extends Product {
  stock: number;
}

export const useProducts = (searchQuery: string = "", categoryId?: string) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    let observable;
    if (debouncedSearch) {
      observable = productRepository.search(debouncedSearch);
    } else if (categoryId) {
      observable = productRepository.observeByCategory(categoryId);
    } else {
      observable = productRepository.observeAll();
    }

    const subscription = observable.subscribe((result) => {
      setProducts(result);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [debouncedSearch, categoryId]);

  return { products, isLoading };
};

export function useProductsWithStock(searchQuery: string, categoryId?: string) {
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

    const subscription = query.observe().subscribe(async (rawProducts) => {
      try {
        // تحسين الأداء عبر جلب الأرصدة دفعة واحدة أو بشكل متوازي آمن
        const productsWithStock = await Promise.all(
          rawProducts.map(async (product) => {
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
      .subscribe((value) => {
        setStock(value);
      });

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
        next: (data) => {
          if (isMounted) {
            setCategories(data);
            setIsLoading(false);
          }
        },
        error: (err) => {
          if (isMounted) {
            setError(err);
            setIsLoading(false);
          }
        },
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { categories, isLoading, error };
}
