// hooks/useSalesInvoiceHistory.ts
import { useEffect, useRef, useState } from "react";
import { services } from "src/application/compositionRoot";
import SalesInvoice from "src/database/models/SalesInvoice";
import dayjs from "dayjs";

export interface SalesInvoiceHistoryItem {
  invoice: SalesInvoice;
  customerName?: string;
}

export interface SalesInvoiceHistoryState {
  items: SalesInvoiceHistoryItem[];
  isLoading: boolean;
  error: Error | null;
  todayCount: number;
  todayTotal: number;
}

/**
 * Hook لجلب فواتير البيع مع أسماء العملاء + إحصاءات اليوم.
 *
 * يتبع المعمارية:
 *   - services.salesInvoice.observeAll() / searchByInvoiceNumber() للبيانات الحية.
 *   - services.customer.getById() لأسماء العملاء.
 *   - Map cache لتجنّب N+1 عند التحديثات المتكررة.
 */
export function useSalesInvoiceHistory(
  searchQuery: string,
): SalesInvoiceHistoryState {
  const [state, setState] = useState<SalesInvoiceHistoryState>({
    items: [],
    isLoading: true,
    error: null,
    todayCount: 0,
    todayTotal: 0,
  });
  const customerNameCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const observable = searchQuery.trim()
      ? services.salesInvoice.searchByInvoiceNumber(searchQuery.trim())
      : services.salesInvoice.observeAll();

    const sub = observable.subscribe({
      next: async (invoices) => {
        if (cancelled) return;

        // ─── إثراء بأسماء العملاء (مع cache) ───
        const items: SalesInvoiceHistoryItem[] = await Promise.all(
          invoices.map(async (inv) => {
            const cid =
              (inv as any).customerId || (inv as any)._raw?.customer_id;

            if (!cid) {
              return { invoice: inv };
            }

            if (customerNameCache.current.has(cid)) {
              return {
                invoice: inv,
                customerName: customerNameCache.current.get(cid),
              };
            }

            try {
              const customer = await services.customer.getById(cid);
              const name = customer?.name;
              if (name) customerNameCache.current.set(cid, name);
              return { invoice: inv, customerName: name };
            } catch {
              return { invoice: inv };
            }
          }),
        );

        // ─── إحصاءات اليوم ───
        const today = dayjs().startOf("day");
        const todayInvoices = invoices.filter((inv) =>
          dayjs(inv.invoiceDate).isSame(today, "day"),
        );
        const todayTotal = todayInvoices.reduce(
          (sum, inv) => sum + inv.total,
          0,
        );

        if (!cancelled) {
          setState({
            items,
            isLoading: false,
            error: null,
            todayCount: todayInvoices.length,
            todayTotal,
          });
        }
      },
      error: (err) => {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err : new Error(String(err)),
            isLoading: false,
          }));
        }
      },
    });

    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, [searchQuery]);

  return state;
}
