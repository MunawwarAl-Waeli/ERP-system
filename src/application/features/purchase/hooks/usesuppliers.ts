// hooks/useSuppliers.ts
import { useState, useEffect, SetStateAction } from "react";
import { database } from "src/database";
import Supplier from "src/database/models/Supplier";
import { Q } from "@nozbe/watermelondb";

export function useSuppliers(searchTerm: string) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const collection = database.get<Supplier>("suppliers");

    let query = collection.query(Q.sortBy("name", Q.asc));

    if (searchTerm.trim()) {
      query = query.extend(
        Q.where("name", Q.like(`%${Q.sanitizeLikeString(searchTerm)}%`)),
      );
    }

    const subscription = query.observe().subscribe({
      next: (data: SetStateAction<Supplier[]>) => {
        if (isMounted) {
          setSuppliers(data);
          setIsLoading(false);
        }
      },
      error: () => setIsLoading(false),
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [searchTerm]);

  return { suppliers, isLoading };
}
