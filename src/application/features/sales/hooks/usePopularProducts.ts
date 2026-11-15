import { useState, useEffect, useCallback } from "react";
import { repositories } from "src/application/compositionRoot";

export const usePopularProducts = (limit: number = 20) => {
  const [popularProductIds, setPopularProductIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPopularIds = useCallback(async () => {
    try {
      setIsLoading(true);
      const sortedIds = await repositories.salesInvoice.getPopularProductIds(limit);
      setPopularProductIds(sortedIds);
    } catch (error) {
      console.error("[usePopularProducts] Failed to fetch:", error);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchPopularIds();
  }, [fetchPopularIds]);

  return { popularProductIds, isLoading };
};
