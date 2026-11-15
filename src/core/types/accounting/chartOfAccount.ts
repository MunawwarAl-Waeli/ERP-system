import { AccountType } from "@core/constants";

export interface ChartOfAccountData {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  allowPosting: boolean;
  isCashAccount: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateChartOfAccountInput {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  allowPosting: boolean;
  isCashAccount: boolean;
}

export interface UpdateChartOfAccountInput {
  name?: string;
  allowPosting?: boolean;
  isCashAccount?: boolean;
  isActive?: boolean;
}
