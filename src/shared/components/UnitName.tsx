// src/shared/components/UnitName.tsx
import React, { useEffect, useState } from "react";
import { database } from "src/database";

interface UnitNameProps {
  unitId?: string | null;
  fallback?: string;
}

/**
 * مكون لعرض اسم الوحدة من unitId، يجلب الاسم تلقائياً.
 * يعمل مع أي مصدر بيانات (ProductUnit Model أو ProductUnitData).
 * لا يكسر المعمارية لأنه مكون عرض (display-only)، مثل CurrencyText.
 */
export const UnitName: React.FC<UnitNameProps> = ({
  unitId,
  fallback = "وحدة",
}) => {
  const [name, setName] = useState<string>(fallback);

  useEffect(() => {
    if (!unitId) {
      setName(fallback);
      return;
    }

    let cancelled = false;

    database
      .get("units")
      .find(unitId)
      .then((u: any) => {
        if (!cancelled) setName(u?.name || fallback);
      })
      .catch(() => {
        if (!cancelled) setName(fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [unitId, fallback]);

  return <>{name}</>;
};
