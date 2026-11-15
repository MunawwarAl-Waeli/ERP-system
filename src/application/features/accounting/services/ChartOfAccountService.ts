import {
  ChartOfAccountData,
  CreateChartOfAccountInput,
  UpdateChartOfAccountInput,
} from "@core/types/accounting/chartOfAccount";

export interface ChartOfAccountService {
  getById(id: string): Promise<ChartOfAccountData | null>;

  getByCode(code: string): Promise<ChartOfAccountData | null>;

  getAll(): Promise<ChartOfAccountData[]>;

  getActive(): Promise<ChartOfAccountData[]>;

  getPostingAccounts(): Promise<ChartOfAccountData[]>;

  getCashAccounts(): Promise<ChartOfAccountData[]>;

  getChildren(parentId: string): Promise<ChartOfAccountData[]>;

  getRootAccounts(): Promise<ChartOfAccountData[]>;

  create(input: CreateChartOfAccountInput): Promise<ChartOfAccountData>;

  update(
    id: string,
    input: UpdateChartOfAccountInput,
  ): Promise<ChartOfAccountData>;

  deactivate(id: string): Promise<ChartOfAccountData>;

  activate(id: string): Promise<ChartOfAccountData>;
}
