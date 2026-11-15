export interface AccountingPeriodData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  closedAt?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAccountingPeriodInput {
  name: string;
  startDate: string;
  endDate: string;
}

export interface CloseAccountingPeriodInput {
  id: string;
  closedAt: string;
}

export interface AccountingPeriodSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}
