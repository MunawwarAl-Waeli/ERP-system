// hooks/usePurchaseInvoices.ts
import { useState, useEffect } from "react";

import PurchaseInvoice from "@core/database/models/PurchaseInvoice";
import {
  PurchaseInvoiceStatus,
  purchaseRepository,
} from "../repositories/purchaseRepository";
import PurchaseInvoiceItem from "@core/database/models/PurchaseInvoiceItem";

export function usePurchaseInvoices(status?: PurchaseInvoiceStatus) {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    const query = status
      ? purchaseRepository.observeByStatus(status)
      : purchaseRepository.observeAll();

    const subscription = query.subscribe({
      next: (data) => {
        if (isMounted) {
          setInvoices(data);
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
      next: (invoice) => {
        if (isMounted) {
          setData((prev) => ({ ...prev, invoice }));
        }
      },
      error: (err) => {
        if (isMounted) {
          setData((prev) => ({ ...prev, error: err, isLoading: false }));
        }
      },
    });
    subscriptions.push(invoiceSub);

    // 2. اشتراك في بنود الفاتورة
    const itemsSub = purchaseRepository.observeItems(invoiceId).subscribe({
      next: (items) => {
        if (isMounted) {
          setData((prev) => ({ ...prev, items, isLoading: false }));
        }
      },
      error: (err) => {
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
