// hooks/usePurchaseInvoices.ts
import { useState, useEffect, SetStateAction } from "react";

import PurchaseInvoice from "src/database/models/PurchaseInvoice";
import {
  PurchaseInvoiceStatus,
  purchaseRepository,
} from "../repositories/PurchaseInvoiceRepository";
import PurchaseInvoiceItem from "src/database/models/PurchaseInvoiceItem";

export function usePurchaseInvoices(status?: PurchaseInvoiceStatus) {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    const effective = (status as string) === "approved" ? "posted" : status;
    const query = effective && effective !== ("all" as any)
      ? purchaseRepository.observeByStatus(effective as any)
      : purchaseRepository.observeAll();

    const subscription = query.subscribe({
      next: (data: SetStateAction<PurchaseInvoice[]>) => {
        if (isMounted) {
          setInvoices(data);
          setIsLoading(false);
        }
      },
      error: (err: SetStateAction<Error | null>) => {
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
  }, [status]);

  return { invoices, isLoading, error };
}

interface InvoiceDetail {
  invoice: PurchaseInvoice | null;
  items: PurchaseInvoiceItem[];
  isLoading: boolean;
  error?: Error;
}

export function usePurchaseInvoiceDetail(invoiceId: string): InvoiceDetail {
  const [data, setData] = useState<InvoiceDetail>({
    invoice: null,
    items: [],
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;
    const subscriptions: Array<{ unsubscribe: () => void }> = [];

    // 1. اشتراك في الفاتورة نفسها
    const invoiceSub = purchaseRepository.observeById(invoiceId).subscribe({
      next: (invoice: any) => {
        if (isMounted) {
          setData((prev) => ({ ...prev, invoice }));
        }
      },
      error: (err: any) => {
        if (isMounted) {
          setData((prev) => ({ ...prev, error: err, isLoading: false }));
        }
      },
    });
    subscriptions.push(invoiceSub);

    // 2. اشتراك في بنود الفاتورة
    const itemsSub = purchaseRepository.observeItems(invoiceId).subscribe({
      next: (items: any) => {
        if (isMounted) {
          setData((prev) => ({ ...prev, items, isLoading: false }));
        }
      },
      error: (err: any) => {
        if (isMounted) {
          setData((prev) => ({ ...prev, error: err, isLoading: false }));
        }
      },
    });
    subscriptions.push(itemsSub);

    return () => {
      isMounted = false;
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
  }, [invoiceId]);

  return data;
}
