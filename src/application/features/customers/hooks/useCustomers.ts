import { useState, useEffect } from "react";
import { customerRepository } from "../repositories/customerRepository";
import Customer from "src/database/models/Customer";
import { useDebounce } from "@shared/hooks/useDebounce";

// ========================================
// 1. هوك قائمة العملاء (مع البحث التفاعلي)
// ========================================
export const useCustomers = (searchQuery: string = "") => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    setIsLoading(true);

    const observable = debouncedSearch
      ? customerRepository.search(debouncedSearch)
      : customerRepository.observeAll();

    const subscription = observable.subscribe({
      next: (result: Customer[]) => {
        setCustomers(result);
        setIsLoading(false);
      },
      error: (err: unknown) => {
        console.error("[useCustomers] Error:", err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [debouncedSearch]);

  return { customers, isLoading };
};

// ========================================
// 2. هوك مراقبة خريطة أرصدة كافة العملاء لحظياً
// ========================================
export const useCustomerCredits = () => {
  const [creditMap, setCreditMap] = useState<Record<string, number>>({});
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  useEffect(() => {
    const subscription = customerRepository.observeCreditsMap().subscribe({
      next: (map) => {
        setCreditMap(map);
        setIsLoadingCredits(false);
      },
      error: (err: unknown) => {
        console.error("[useCustomerCredits] Error:", err);
        setIsLoadingCredits(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  return { creditMap, isLoadingCredits };
};

// ========================================
// 3. هوك تفاصيل العميل والرصيد اللحظي
// ========================================
export const useCustomerDetail = (customerId: string) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [outstandingCredit, setOutstandingCredit] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ✅ معالجة الحالات التي يكون فيها customerId غير متوفر بعد
    if (!customerId) {
      setCustomer(null);
      setOutstandingCredit(0);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    // 1. مراقبة بيانات العميل
    const customerSub = customerRepository.observeById(customerId).subscribe({
      next: (cust: Customer) => {
        if (isMounted) setCustomer(cust);
      },
      error: (err: unknown) => {
        console.error("[useCustomerDetail] Customer error:", err);
      },
    });

    // 2. مراقبة رصيد العميل لحظياً من المستودع
    const balanceSub = customerRepository
      .observeOutstandingBalance(customerId)
      .subscribe({
        next: (balance: number) => {
          if (isMounted) {
            setOutstandingCredit(balance);
            setIsLoading(false);
          }
        },
        error: (err: unknown) => {
          console.error("[useCustomerDetail] Balance error:", err);
          if (isMounted) setIsLoading(false);
        },
      });

    return () => {
      isMounted = false;
      customerSub.unsubscribe();
      balanceSub.unsubscribe();
    };
  }, [customerId]);

  return { customer, outstandingCredit, isLoading };
};
