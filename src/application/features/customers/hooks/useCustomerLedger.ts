import { useState, useEffect } from "react";
import { Q } from "@nozbe/watermelondb";
import { combineLatest, Subscription } from "rxjs";
import { database } from "src/database";
import SalesInvoice from "src/database/models/SalesInvoice";
import ReceiptVoucher from "src/database/models/ReceiptVoucher";

// ========================================
// 1. Ledger Item Interface
// ========================================

export interface LedgerTransactionItem {
  id: string;
  type: "invoice" | "receipt";
  date: string | number | Date;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface UseCustomerLedgerReturn {
  transactions: LedgerTransactionItem[];
  outstandingBalance: number;
  isLoading: boolean;
}

// ========================================
// 2. Custom Hook Implementation
// ========================================

export const useCustomerLedger = (
  customerId: string,
): UseCustomerLedgerReturn => {
  const [transactions, setTransactions] = useState<LedgerTransactionItem[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      setTransactions([]);
      setOutstandingBalance(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const invoicesCollection = database.get<SalesInvoice>("sales_invoices");
    const receiptsCollection = database.get<ReceiptVoucher>("receipt_vouchers");

    const invoicesQuery = invoicesCollection.query(
      Q.where("customer_id", customerId),
    );
    const receiptsQuery = receiptsCollection.query(
      Q.where("customer_id", customerId),
    );

    // دمج مراقبة الجداول في اشتراك واحد لمنع الـ Double-Render والتأكد من التزامن
    const subscription: Subscription = combineLatest([
      invoicesQuery.observe(),
      receiptsQuery.observe(),
    ]).subscribe({
      next: function ([invoices, receipts]): void {
            const rawTransactions: Omit<LedgerTransactionItem, "runningBalance">[] = [];

            // 1. تجميع الفواتير المعتمدة (مدين)
            invoices.forEach(
                (inv: {
                    isCancelled: any;
                    status: string;
                    id: string | any[];
                    invoiceDate: any;
                    invoiceNumber: any;
                    total: any;
                }) => {
                    if (inv.isCancelled || inv.status === "draft") return;
                    rawTransactions.push({
                        id: inv.id,
                        type: "invoice",
                        date: inv.invoiceDate || Date.now(),
                        description: `فاتورة مبيعات #${inv.invoiceNumber || inv.id.slice(0, 6)}`,
                        debit: Number(inv.total || 0),
                        credit: 0,
                    });
                }
            );

            // 2. تجميع سندات القبض المعتمدة (دائن)
            receipts.forEach(
                (rec: {
                    isCancelled: any;
                    status: string;
                    id: string | any[];
                    voucherDate: any;
                    voucherNumber: any;
                    amount: any;
                }) => {
                    if (rec.isCancelled || rec.status !== "posted") return;
                    rawTransactions.push({
                        id: rec.id,
                        type: "receipt",
                        date: rec.voucherDate || Date.now(),
                        description: `سند قبض #${rec.voucherNumber || rec.id.slice(0, 6)}`,
                        debit: 0,
                        credit: Number(rec.amount || 0),
                    });
                }
            );

            // 3. فرز الحركات زمنياً تصاعدياً (الأقدم أولاً) للحساب التراكمي الصحيح
            rawTransactions.sort((a, b) => {
                const timeA = new Date(a.date).getTime();
                const timeB = new Date(b.date).getTime();
                return timeA - timeB;
            });

            // 4. حساب الرصيد التراكمي في مرور واحد (Single Pass)
            let currentBalance = 0;
            const computedTransactions: LedgerTransactionItem[] = rawTransactions.map((tx) => {
                currentBalance += tx.debit - tx.credit;
                return {
                    ...tx,
                    runningBalance: currentBalance,
                };
            });

            // 5. عكس الترتيب للعرض في القائمة (الأحدث أولاً)
            computedTransactions.reverse();

            setTransactions(computedTransactions);
            setOutstandingBalance(currentBalance);
            setIsLoading(false);
        },
      error: (err) => {
        console.error("[useCustomerLedger] Error observing ledger data:", err);
        setIsLoading(false);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [customerId]);

  return { transactions, outstandingBalance, isLoading };
};
