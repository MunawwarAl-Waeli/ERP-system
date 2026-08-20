import { database } from "@core/database";
import AccountingSetting from "@core/database/models/AccountingSetting";
import ChartOfAccount from "@core/database/models/ChartOfAccount";
import { Q } from "@nozbe/watermelondb";

const settingsCollection = database.get<AccountingSetting>(
  "accounting_settings",
);

const accountsCollection = database.get<ChartOfAccount>("chart_of_accounts");

export interface AccountingSettings {
  inventoryAccountId: string;

  salesAccountId: string;

  serviceRevenueAccountId: string;

  cogsAccountId: string;

  customersAccountId: string;

  suppliersAccountId: string;

  cashAccountId: string;

  bankAccountId: string;
}

export const AccountingSettingsService = {
  getSettings: async (): Promise<AccountingSettings> => {
    const settings = await settingsCollection.query().fetch();

    if (settings.length > 0) {
      const row = settings[0];

      return {
        inventoryAccountId: row.inventoryAccountId,

        salesAccountId: row.salesAccountId,

        serviceRevenueAccountId: row.serviceRevenueAccountId ?? "",

        cogsAccountId: row.cogsAccountId,

        customersAccountId: row.customersAccountId,

        suppliersAccountId: row.suppliersAccountId,

        cashAccountId: row.cashDefaultAccountId,

        bankAccountId: row.bankDefaultAccountId ?? "",
      };
    }

    return AccountingSettingsService.getDefaultSettings();
  },

  getDefaultSettings: async (): Promise<AccountingSettings> => {
    const findAccount = async (code: string) => {
      const result = await accountsCollection
        .query(Q.where("code", code))
        .fetch();

      return result[0]?.id ?? "";
    };

    return {
      inventoryAccountId: await findAccount("1200"),

      salesAccountId: await findAccount("4100"),

      serviceRevenueAccountId: await findAccount("4200"),

      cogsAccountId: await findAccount("6000"),

      customersAccountId: await findAccount("1300"),

      suppliersAccountId: await findAccount("2100"),

      cashAccountId: await findAccount("1110"),

      bankAccountId: await findAccount("1120"),
    };
  },
};
