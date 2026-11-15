// hooks/useSalesInvoiceDetail.ts
import { useEffect, useRef, useState } from "react";
import { repositories } from "src/application/compositionRoot";
import { database } from "src/database";
import { CustomerData } from "src/core/types/sales/customer";
import SalesInvoice from "src/database/models/SalesInvoice";
import SalesInvoiceItem from "src/database/models/SalesInvoiceItem";
import { Q } from "@nozbe/watermelondb";

export interface SalesInvoiceItemWithName {
  item: SalesInvoiceItem;
  productName: string;
  productId: string | null;
}

export interface SalesInvoiceDetailState {
  invoice: SalesInvoice | null;
  items: SalesInvoiceItem[];
  itemsWithNames: SalesInvoiceItemWithName[];
  customer: CustomerData | null;
  isLoading: boolean;
  error: Error | null;
}

const INITIAL_STATE: SalesInvoiceDetailState = {
  invoice: null,
  items: [],
  itemsWithNames: [],
  customer: null,
  isLoading: true,
  error: null,
};

export function useSalesInvoiceDetail(
  invoiceId: string | null | undefined,
): SalesInvoiceDetailState {
  const [state, setState] = useState<SalesInvoiceDetailState>(INITIAL_STATE);
  const productNameCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!invoiceId) {
      setState({ ...INITIAL_STATE, isLoading: false });
      return;
    }

    let cancelled = false;
    let itemsPromiseId = 0;

    // ─── 1. Observe invoice ───
    const invoiceCollection = database.get<SalesInvoice>("sales_invoices");

    const invoiceSub = invoiceCollection.findAndObserve(invoiceId).subscribe({
      // ✅ إجبار TypeScript على استخدام النوع SalesInvoice
      next: async (inv: SalesInvoice) => {
        if (cancelled) return;

        setState((prev) => ({
          ...prev,
          invoice: inv,
          isLoading: false,
          error: null,
        }));

        // ✅ استخدام _raw للوصول للحقل بأمان وتجنب مشاكل العلاقات
        const customerId =
          (inv as any).customerId || (inv as any)._raw?.customer_id;

        if (customerId) {
          try {
            const cust = await repositories.customer.getById(customerId);
            if (!cancelled) {
              setState((prev) => ({ ...prev, customer: cust }));
            }
          } catch {
            if (!cancelled) {
              setState((prev) => ({ ...prev, customer: null }));
            }
          }
        } else {
          if (!cancelled) {
            setState((prev) => ({ ...prev, customer: null }));
          }
        }
      },
      error: (err: Error | null) => {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err : new Error(String(err)),
            isLoading: false,
          }));
        }
      },
    });

    // ─── 2. Observe items ───
    const itemsCollection = database.get<SalesInvoiceItem>(
      "sales_invoice_items",
    );

    const itemsSub = itemsCollection
      .query(Q.where("sales_invoice_id", invoiceId))
      .observe()
      .subscribe({
        // ✅ إجبار TypeScript على استخدام النوع SalesInvoiceItem[]
        next: async (items: SalesInvoiceItem[]) => {
          if (cancelled) return;

          setState((prev) => ({ ...prev, items }));

          const currentPromiseId = ++itemsPromiseId;

          const resolved: SalesInvoiceItemWithName[] = await Promise.all(
            // ✅ إجبار TypeScript على استخدام النوع SalesInvoiceItem
            items.map(
              async (
                item: SalesInvoiceItem,
              ): Promise<SalesInvoiceItemWithName> => {
                // ✅ استخدام _raw للوصول للحقل بأمان
                const pid =
                  (item as any).productId ||
                  (item as any)._raw?.product_id ||
                  null;

                if (!pid) {
                  return { item, productName: "", productId: null };
                }

                if (productNameCache.current.has(pid)) {
                  return {
                    item,
                    productName: productNameCache.current.get(pid) || "",
                    productId: pid,
                  };
                }

                try {
                  const product = await repositories.product.getById(pid);
                  const name = product?.name || "";
                  productNameCache.current.set(pid, name);
                  return { item, productName: name, productId: pid };
                } catch {
                  productNameCache.current.set(pid, "");
                  return { item, productName: "", productId: pid };
                }
              },
            ),
          );

          if (!cancelled && currentPromiseId === itemsPromiseId) {
            setState((prev) => ({ ...prev, itemsWithNames: resolved }));
          }
        },
        error: (err: Error | null) => {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              error: err instanceof Error ? err : new Error(String(err)),
            }));
          }
        },
      });

    return () => {
      cancelled = true;
      invoiceSub.unsubscribe();
      itemsSub.unsubscribe();
    };
  }, [invoiceId]);

  return state;
}
