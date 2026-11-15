/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";

import ChartOfAccount, {
  AccountType,
} from "src/database/models/ChartOfAccount";

import { accountingRepository } from "../repositories/AccountingSettingRepository";
import { useDebounce } from "@shared/hooks/useDebounce";
import { AccountingSetting } from "src/database";

const getAccountsObservable = (
  search: string,
  type?: AccountType,
  cashOnly?: boolean,
) => {
  if (search) {
    return accountingRepository.search(search);
  }

  if (cashOnly) {
    return accountingRepository.observeCashAccounts();
  }

  if (type) {
    return accountingRepository.observeByType(type);
  }

  return accountingRepository.observeActive();
};

export const useAccounts = (
  searchQuery: string = "",
  type?: AccountType,
  cashOnly: boolean = false,
) => {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    const observable = getAccountsObservable(debouncedSearch, type, cashOnly);

    const subscription = observable.subscribe((result) => {
      setAccounts(result);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [debouncedSearch, type, cashOnly]);

  return {
    accounts,
    isLoading,
  };
};
export const useAccountChildren = (
  parentId: string,
  enabled: boolean = true,
) => {
  const [children, setChildren] = useState<ChartOfAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    const subscription = accountingRepository
      .observeChildren(parentId)
      .subscribe((result) => {
        setChildren(result);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [parentId, enabled]);

  return {
    children,
    isLoading,
  };
};
export const useCashAccounts = () => useAccounts("", undefined, true);

export const useAccountsByType = (type: AccountType) => useAccounts("", type);

export const useAccountDetail = (accountId: string) => {
  const [account, setAccount] = useState<ChartOfAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    const subscription = accountingRepository
      .observeById(accountId)
      .subscribe((result) => {
        setAccount(result);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [accountId]);

  return {
    account,
    isLoading,
  };
};

export const useAccountingSettings = () => {
  const [settings, setSettings] = useState<AccountingSetting | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    const subscription = accountingRepository
      .observeSettings()
      .subscribe((result) => {
        setSettings(result[0] ?? null);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  return {
    settings,
    isLoading,
    error: null as Error | null,
  };
};
export const useRootAccounts = () => {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const subscribe = useCallback(() => {
    setError(null);
    // لا نعيد isLoading إلى true في التحديثات التالية حتى لا يظهر مؤشر تحميل كامل مرة أخرى
    const subscription = accountingRepository.observeRootAccounts().subscribe({
      next: (result) => {
        setAccounts(result);
        setIsLoading(false);
      },
      error: (err) => {
        setError(err);
        setIsLoading(false);
      },
    });
    return subscription;
  }, []);

  useEffect(() => {
    const subscription = subscribe();
    return () => subscription.unsubscribe();
  }, [subscribe]);

  const refresh = useCallback(() => {
    // يمكن إعادة الاشتراك لفرض تحديث، أو الاعتماد على WatermelonDB التفاعلي
    // إذا كانت هناك حاجة لمزامنة خارجية يمكن إضافتها هنا
  }, []);

  return { accounts, isLoading, error, refresh };
};
