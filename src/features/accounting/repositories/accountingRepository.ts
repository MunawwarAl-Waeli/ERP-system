/* eslint-disable require-await */
/* eslint-disable arrow-body-style */
import { database } from "@core/database";
import ChartOfAccount, {
  AccountType,
} from "@core/database/models/ChartOfAccount";
import AccountingSetting from "@core/database/models/AccountingSetting";
import { Q } from "@nozbe/watermelondb";

import {
  AccountFormData,
  AccountingSettingsFormData,
} from "@features/accounting/schema/accountingSchema";

const accountsCollection = database.get<ChartOfAccount>("chart_of_accounts");

const settingsCollection = database.get<AccountingSetting>(
  "accounting_settings",
);

// ============================================================
// Helpers
// ============================================================

const normalizeString = (value: string): string => value.trim();

const normalizeParentId = (
  parentId: string | null | undefined,
): string | null => {
  if (!parentId || !parentId.trim()) {
    return null;
  }

  return parentId.trim();
};

const validateAccountCode = async (
  code: string,
  excludeId?: string,
): Promise<void> => {
  const normalizedCode = normalizeString(code);

  const conditions = [Q.where("code", normalizedCode)];

  if (excludeId) {
    conditions.push(Q.where("id", Q.notEq(excludeId)));
  }

  const existing = await accountsCollection.query(...conditions).fetch();

  if (existing.length > 0) {
    throw new Error("ACCOUNT_CODE_ALREADY_EXISTS");
  }
};

const validateParentAccount = async (
  parentId: string | null,
  accountId?: string,
): Promise<void> => {
  if (!parentId) {
    return;
  }

  if (accountId && parentId === accountId) {
    throw new Error("ACCOUNT_CANNOT_BE_ITS_OWN_PARENT");
  }

  const parent = await accountsCollection.find(parentId);

  if (!parent.isActive) {
    throw new Error("PARENT_ACCOUNT_IS_INACTIVE");
  }
};

const applyAccountData = (
  account: ChartOfAccount,
  data: AccountFormData,
): void => {
  account.code = normalizeString(data.code);
  account.name = normalizeString(data.name);
  account.type = data.type;
  account.parentId = normalizeParentId(data.parentId);
  account.isCashAccount = Boolean(data.isCashAccount);
  account.isActive = true;
};

const applySettingsData = (
  settings: AccountingSetting,
  data: AccountingSettingsFormData,
): void => {
  settings.inventoryAccountId = data.inventoryAccountId;

  settings.salesAccountId = data.salesAccountId;

  settings.cogsAccountId = data.cogsAccountId;

  settings.customersAccountId = data.customersAccountId;

  settings.suppliersAccountId = data.suppliersAccountId;

  settings.cashDefaultAccountId = data.cashDefaultAccountId;

  settings.bankDefaultAccountId = data.bankDefaultAccountId || null;

  settings.serviceRevenueAccountId = data.serviceRevenueAccountId || null;

  settings.incomeSummaryAccountId = data.incomeSummaryAccountId || null;

  settings.retainedEarningsAccountId = data.retainedEarningsAccountId || null;
};

// ============================================================
// Repository
// ============================================================

export const accountingRepository = {
  // ==========================================================
  // Chart Of Accounts - Observers
  // ==========================================================

  /**
   * جميع الحسابات بما فيها غير النشطة.
   */
  observeAll: () => accountsCollection.query(Q.sortBy("code", Q.asc)).observe(),

  /**
   * الحسابات النشطة فقط.
   */
  observeActive: () =>
    accountsCollection
      .query(Q.where("is_active", true), Q.sortBy("code", Q.asc))
      .observe(),

  /**
   * الحسابات النقدية النشطة.
   */
  observeCashAccounts: () =>
    accountsCollection
      .query(
        Q.where("is_active", true),
        Q.where("is_cash_account", true),
        Q.sortBy("code", Q.asc),
      )
      .observe(),

  /**
   * الحسابات حسب نوع الحساب.
   */
  observeByType: (type: AccountType) =>
    accountsCollection
      .query(
        Q.where("type", type),
        Q.where("is_active", true),
        Q.sortBy("code", Q.asc),
      )
      .observe(),

  /**
   * الحسابات الرئيسية Root Accounts.
   */
  observeRootAccounts: () =>
    accountsCollection
      .query(
        Q.where("parent_id", null),
        Q.where("is_active", true),
        Q.sortBy("code", Q.asc),
      )
      .observe(),

  /**
   * الحسابات الفرعية لحساب معين.
   */
  observeChildren: (parentId: string) =>
    accountsCollection
      .query(
        Q.where("parent_id", parentId),
        Q.where("is_active", true),
        Q.sortBy("code", Q.asc),
      )
      .observe(),

  /**
   * البحث في الحسابات النشطة.
   */
  search: (keyword: string) => {
    const normalizedKeyword = normalizeString(keyword);

    if (!normalizedKeyword) {
      return accountsCollection
        .query(Q.where("is_active", true), Q.sortBy("code", Q.asc))
        .observe();
    }

    const sanitizedKeyword = Q.sanitizeLikeString(normalizedKeyword);

    return accountsCollection
      .query(
        Q.where("is_active", true),
        Q.or(
          Q.where("name", Q.like(`%${sanitizedKeyword}%`)),
          Q.where("code", Q.like(`%${sanitizedKeyword}%`)),
        ),
        Q.sortBy("code", Q.asc),
      )
      .observe();
  },

  // ==========================================================
  // Chart Of Accounts - Queries
  // ==========================================================

  getById: (id: string) => accountsCollection.find(id),

  observeById: (id: string) => accountsCollection.findAndObserve(id),

  /**
   * جلب الحساب الأب مباشرة.
   */
  getParent: async (
    parentId: string | null | undefined,
  ): Promise<ChartOfAccount | null> => {
    const normalizedParentId = normalizeParentId(parentId);

    if (!normalizedParentId) {
      return null;
    }

    return accountsCollection.find(normalizedParentId);
  },

  /**
   * التحقق من وجود حساب بكود معين.
   */
  codeExists: async (code: string, excludeId?: string): Promise<boolean> => {
    const normalizedCode = normalizeString(code);

    if (!normalizedCode) {
      return false;
    }

    const conditions = [Q.where("code", normalizedCode)];

    if (excludeId) {
      conditions.push(Q.where("id", Q.notEq(excludeId)));
    }

    const records = await accountsCollection.query(...conditions).fetch();

    return records.length > 0;
  },

  // ==========================================================
  // Chart Of Accounts - Mutations
  // ==========================================================

  /**
   * إنشاء حساب جديد.
   */
  create: async (data: AccountFormData) => {
    const code = normalizeString(data.code);
    const name = normalizeString(data.name);
    const parentId = normalizeParentId(data.parentId);

    if (!code) {
      throw new Error("ACCOUNT_CODE_REQUIRED");
    }

    if (!name) {
      throw new Error("ACCOUNT_NAME_REQUIRED");
    }

    await validateAccountCode(code);

    await validateParentAccount(parentId);

    return database.write(async () => {
      return accountsCollection.create((account: ChartOfAccount) => {
        applyAccountData(account, {
          ...data,
          code,
          name,
          parentId,
        });
      });
    });
  },

  /**
   * تحديث حساب موجود.
   */
  update: async (id: string, data: AccountFormData) => {
    const account = await accountsCollection.find(id);

    const code = normalizeString(data.code);
    const name = normalizeString(data.name);
    const parentId = normalizeParentId(data.parentId);

    if (!code) {
      throw new Error("ACCOUNT_CODE_REQUIRED");
    }

    if (!name) {
      throw new Error("ACCOUNT_NAME_REQUIRED");
    }

    await validateAccountCode(code, id);

    await validateParentAccount(parentId, id);

    return database.write(() =>
      account.update((currentAccount) => {
        applyAccountData(currentAccount, {
          ...data,
          code,
          name,
          parentId,
          id,
        });
      }),
    );
  },

  /**
   * تعطيل الحساب بدل حذفه.
   */
  deactivate: async (id: string) => {
    const account = await accountsCollection.find(id);

    return database.write(() =>
      account.update((currentAccount) => {
        currentAccount.isActive = false;
      }),
    );
  },

  /**
   * إعادة تفعيل الحساب.
   */
  activate: async (id: string) => {
    const account = await accountsCollection.find(id);

    return database.write(() =>
      account.update((currentAccount) => {
        currentAccount.isActive = true;
      }),
    );
  },

  // ==========================================================
  // Accounting Settings - Observers
  // ==========================================================

  /**
   * إعدادات النظام المحاسبي.
   *
   * يفترض أن النظام يحتوي على سجل إعدادات واحد فقط.
   */
  observeSettings: () => settingsCollection.query().observe(),

  /**
   * جلب إعدادات النظام.
   */
  getSettings: async () => {
    const settings = await settingsCollection.query().fetch();

    return settings[0] ?? null;
  },

  // ==========================================================
  // Accounting Settings - Mutations
  // ==========================================================

  /**
   * إنشاء إعدادات النظام إذا لم تكن موجودة.
   *
   * إذا كانت موجودة يتم تحديثها بدل إنشاء سجل جديد.
   */
  saveSettings: async (data: AccountingSettingsFormData) => {
    const existingSettings = await settingsCollection.query().fetch();

    return database.write(async () => {
      if (existingSettings[0]) {
        return existingSettings[0].update((settings) => {
          applySettingsData(settings, data);
        });
      }

      return settingsCollection.create((settings: AccountingSetting) => {
        applySettingsData(settings, data);
      });
    });
  },

  /**
   * إنشاء إعدادات جديدة بشكل صريح.
   *
   * لا تستخدم هذه الدالة إذا كان النظام
   * يفترض وجود سجل إعدادات واحد.
   */
  createSettings: async (data: AccountingSettingsFormData) => {
    const existingSettings = await settingsCollection.query().fetch();

    if (existingSettings.length > 0) {
      throw new Error("ACCOUNTING_SETTINGS_ALREADY_EXISTS");
    }

    return database.write(() =>
      settingsCollection.create((settings: AccountingSetting) => {
        applySettingsData(settings, data);
      }),
    );
  },

  /**
   * تحديث إعدادات موجودة.
   */
  updateSettings: async (data: AccountingSettingsFormData) => {
    const settings = (await settingsCollection.query().fetch())[0];

    if (!settings) {
      throw new Error("ACCOUNTING_SETTINGS_NOT_FOUND");
    }

    return database.write(() =>
      settings.update((currentSettings) => {
        applySettingsData(currentSettings, data);
      }),
    );
  },
};
