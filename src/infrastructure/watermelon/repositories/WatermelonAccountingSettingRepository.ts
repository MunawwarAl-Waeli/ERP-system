import { Database } from "@nozbe/watermelondb";
import AccountingSetting from "src/database/models/AccountingSetting";

import { AccountingSettingData } from "@core/types/accounting/accountingSetting";

import { AccountingSettingRepository } from "@application/features/accounting/repositories/AccountingSettingRepository";

export class WatermelonAccountingSettingRepository
  implements AccountingSettingRepository
{
  private readonly settingsCollection;

  constructor(private readonly database: Database) {
    // ✅ نجلب المجموعة هنا، وليس في الـ constructor
    this.settingsCollection = this.database.get<AccountingSetting>("accounting_settings");
  }

  async get(): Promise<AccountingSettingData | null> {
    // ✅ نستخدم المجموعة وليس قاعدة البيانات
    const rows = await this.settingsCollection.query().fetch();

    if (rows.length === 0) {
      return null;
    }

    const model = rows[0];

    return {
      id: model.id,
      customersAccountId: model.customersAccountId,
      suppliersAccountId: model.suppliersAccountId,
      cashDefaultAccountId: model.cashDefaultAccountId,
      bankDefaultAccountId: model.bankDefaultAccountId ?? undefined,
      incomeSummaryAccountId: model.incomeSummaryAccountId ?? undefined,
      retainedEarningsAccountId: model.retainedEarningsAccountId ?? undefined,
      inventoryDefaultAccountId: model.inventoryDefaultAccountId ?? undefined,
      salesDefaultAccountId: model.salesDefaultAccountId ?? undefined,
      cogsDefaultAccountId: model.cogsDefaultAccountId ?? undefined,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }
}

