// hooks/useInvoiceDisplayData.ts
import { useEffect, useState } from "react";
import { services } from "src/application/compositionRoot";
import { useTranslation } from "react-i18next";

export interface InvoiceDisplayData {
  supplierName: string;
  productNames: Record<string, string>;
  isLoading: boolean;
}

/**
 * Hook لجلب بيانات العرض (أسماء الموردين والمنتجات) لفاتورة معينة.
 * يستخدم طبقة الخدمات (services) وليس database.get مباشرة — يلتزم بالمعمارية.
 */
export function useInvoiceDisplayData(
  supplierId: string | undefined,
  items: Array<{ productId?: string }>,
): InvoiceDisplayData {
  const { t } = useTranslation("purchases");
  const [supplierName, setSupplierName] = useState<string>("");
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // ─── جلب اسم المورد عبر الخدمة ───
  useEffect(() => {
    if (!supplierId) {
      setSupplierName(t("noSupplier"));
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    services.supplier
      .getById(supplierId)
      .then((sup) => {
        if (!cancelled) {
          setSupplierName(sup?.name || t("noSupplier"));
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSupplierName(t("noSupplier"));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [supplierId, t]);

  // ─── جلب أسماء المنتجات عبر الخدمة (bulk, deduplicated) ───
  useEffect(() => {
    if (!items || items.length === 0) {
      setProductNames({});
      return;
    }

    // نستخرج IDs فريدة فقط لتقليل الاستعلامات
    const uniqueIds = Array.from(
      new Set(
        items
          .map((i) => i.productId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );

    if (uniqueIds.length === 0) {
      setProductNames({});
      return;
    }

    let cancelled = false;

    const loadAll = async () => {
      const names: Record<string, string> = {};
      await Promise.all(
        uniqueIds.map(async (pid) => {
          try {
            const p = await services.product.getById(pid);
            if (p) names[pid] = p.name;
          } catch {
            // نتجاهل الخطأ الفردي — المنتج قد يكون محذوفاً
          }
        }),
      );
      if (!cancelled) setProductNames(names);
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [items]);

  return { supplierName, productNames, isLoading };
}
