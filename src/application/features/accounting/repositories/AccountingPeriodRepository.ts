import {
  AccountingPeriodData,
  CreateAccountingPeriodInput,
} from "@core/types/accounting/accountingPeriod";

export interface AccountingPeriodRepository {
  getById(id: string): Promise<AccountingPeriodData | null>;

  getOpenPeriod(): Promise<AccountingPeriodData | null>;

  getByDate(date: string): Promise<AccountingPeriodData | null>;

  get(): Promise<AccountingPeriodData | null>;

  create(input: CreateAccountingPeriodInput): Promise<AccountingPeriodData>;

  close(id: string, closedAt: string): Promise<AccountingPeriodData>;
}
