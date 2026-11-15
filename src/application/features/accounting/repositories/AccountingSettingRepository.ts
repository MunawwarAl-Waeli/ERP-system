import { database } from "src/database";
import ChartOfAccount from "src/database/models/ChartOfAccount";
import AccountingSetting from "src/database/models/AccountingSetting";
import { Q } from "@nozbe/watermelondb";
import { AccountingSettingData } from "@core/types/accounting/accountingSetting";
import { AccountType } from "@core/constants";
import { AccountingSettingsService } from "@core/services/AccountingSettingsService";
import { WatermelonChartOfAccountRepository } from "@infrastructure/watermelon/repositories/WatermelonChartOfAccountRepository";
import { WatermelonAccountingSettingRepository } from "@infrastructure/watermelon/repositories/WatermelonAccountingSettingRepository";

export interface AccountingSettingRepository {
  get(): Promise<AccountingSettingData | null>;
}

export const accountingSettingDataRepository: AccountingSettingRepository =
  new WatermelonAccountingSettingRepository(database);

const accounts = database.get<ChartOfAccount>("chart_of_accounts");
const settingsCollection = database.get<AccountingSetting>(
  "accounting_settings",
);
const chartCore = new WatermelonChartOfAccountRepository(database);

export const accountingRepository = {
  // Chart of accounts observables
  search: (searchTerm: string) =>
    accounts
      .query(
        Q.where("is_active", true),
        Q.or(
          Q.where("name", Q.like(`%${Q.sanitizeLikeString(searchTerm)}%`)),
          Q.where("code", Q.like(`%${Q.sanitizeLikeString(searchTerm)}%`)),
        ),
        Q.sortBy("code", Q.asc),
      )
      .observe(),

  observeCashAccounts: () =>
    accounts
      .query(
        Q.where("is_active", true),
        Q.where("is_cash_account", true),
        Q.sortBy("code", Q.asc),
      )
      .observe(),

  observeByType: (type: AccountType) =>
    accounts
      .query(
        Q.where("is_active", true),
        Q.where("type", type),
        Q.sortBy("code", Q.asc),
      )
      .observe(),

  observeActive: () =>
    accounts
      .query(Q.where("is_active", true), Q.sortBy("code", Q.asc))
      .observe(),

  observeRootAccounts: () =>
    accounts
      .query(
        Q.where("is_active", true),
        Q.where("parent_id", null),
        Q.sortBy("code", Q.asc),
      )
      .observe(),

  observeChildren: (parentId: string) =>
    accounts
      .query(
        Q.where("is_active", true),
        Q.where("parent_id", parentId),
        Q.sortBy("code", Q.asc),
      )
      .observe(),

  observeById: (id: string) => accounts.findAndObserve(id),

  observeSettings: () => settingsCollection.query().observe(),

  // Chart of accounts write
  create: (data: {
    code: string;
    name: string;
    type: any;
    parentId?: string;
    allowPosting: boolean;
    isCashAccount: boolean;
  }) => chartCore.create(data),

  update: (
    id: string,
    data: {
      name?: string;
      allowPosting?: boolean;
      isCashAccount?: boolean;
      isActive?: boolean;
    },
  ) => chartCore.update(id, data),

  // Settings
  getSettings: () => AccountingSettingsService.getSettings(),
  get: () => AccountingSettingsService.getSettings(),

  createSettings: async (settings: Record<string, string | undefined>) => {
    return database.write(async () => {
      const existing = await settingsCollection.query().fetch();

      if (existing.length > 0) {
        const row = existing[0];
        return row.update((record: any) => {
          for (const [key, value] of Object.entries(settings)) {
            if (value === undefined) continue;
            record[key] = value;
          }
        });
      }
      return settingsCollection.create((record: any) => {
        for (const [key, value] of Object.entries(settings)) {
          record[key] = value ?? "";
        }
      });
    });
  },
  updateSettings: async (field: string, accountId: string) => {
    return database.write(async () => {
      const existing = await settingsCollection.query().fetch();
      if (existing.length === 0) return;
      const row = existing[0];
      await row.update((record: any) => {
        record[field] = accountId;
      });
    });
  },
};

