import { database } from "src/database";
import ChartOfAccount from "src/database/models/ChartOfAccount";
import AccountingSetting from "src/database/models/AccountingSetting";
import { Q } from "@nozbe/watermelondb";

import { ACCOUNT_TYPES } from "src/application/features/accounting/schema/accountingSchema";

/* ============================================================
 * Types
 * ============================================================ */

type AccountType = (typeof ACCOUNT_TYPES)[number];

type SeedAccount = {
  key: string;
  code: string;
  name: string;
  type: AccountType;
  parentKey?: string;
  allowPosting: boolean;
  isCashAccount?: boolean;
};

/* ============================================================
 * Collections
 * ============================================================ */

const accountsCollection = database.get<ChartOfAccount>("chart_of_accounts");

const settingsCollection = database.get<AccountingSetting>(
  "accounting_settings",
);

/* ============================================================
 * Default Chart Of Accounts
 * ============================================================ */

/**
 * الحسابات الأساسية التي يتم إنشاؤها عند أول تشغيل للنظام.
 *
 * ملاحظات:
 * - الحسابات الأب: allowPosting = false
 * - الحسابات النهائية: allowPosting = true
 * - الصندوق والبنك: isCashAccount = true
 *
 * الأكواد مصممة بحيث تكون قابلة للتوسع لاحقًا.
 */
const DEFAULT_ACCOUNTS: SeedAccount[] = [
  /* ==========================================================
   * الأصول
   * ========================================================== */

  {
    key: "assets",
    code: "1000",
    name: "الأصول",
    type: "asset",
    allowPosting: false,
  },

  {
    key: "cash",
    code: "1100",
    name: "النقدية",
    type: "asset",
    parentKey: "assets",
    allowPosting: false,
  },

  {
    key: "mainCash",
    code: "1101",
    name: "الصندوق الرئيسي",
    type: "asset",
    parentKey: "cash",
    allowPosting: true,
    isCashAccount: true,
  },

  {
    key: "banks",
    code: "1200",
    name: "البنوك",
    type: "asset",
    parentKey: "assets",
    allowPosting: false,
  },

  {
    key: "mainBank",
    code: "1201",
    name: "البنك الرئيسي",
    type: "asset",
    parentKey: "banks",
    allowPosting: true,
    isCashAccount: true,
  },

  {
    key: "customers",
    code: "1300",
    name: "العملاء",
    type: "asset",
    parentKey: "assets",
    allowPosting: true,
  },

  {
    key: "inventory",
    code: "1400",
    name: "المخزون",
    type: "asset",
    parentKey: "assets",
    allowPosting: false,
  },

  {
    key: "seedInventory",
    code: "1401",
    name: "مخزون البذور",
    type: "asset",
    parentKey: "inventory",
    allowPosting: false,
  },

  {
    key: "beanInventory",
    code: "140101",
    name: "مخزون بذور الفاصوليا الرقشاء",
    type: "asset",
    parentKey: "seedInventory",
    allowPosting: true,
  },

  {
    key: "whiteBeanInventory",
    code: "140102",
    name: "مخزون بذور الفاصوليا البيضاء",
    type: "asset",
    parentKey: "seedInventory",
    allowPosting: true,
  },

  /* ==========================================================
   * الالتزامات
   * ========================================================== */

  {
    key: "liabilities",
    code: "2000",
    name: "الالتزامات",
    type: "liability",
    allowPosting: false,
  },

  {
    key: "suppliers",
    code: "2100",
    name: "الموردون",
    type: "liability",
    parentKey: "liabilities",
    allowPosting: true,
  },

  {
    key: "loans",
    code: "2200",
    name: "القروض والالتزامات التمويلية",
    type: "liability",
    parentKey: "liabilities",
    allowPosting: false,
  },

  {
    key: "otherLiabilities",
    code: "2300",
    name: "التزامات أخرى",
    type: "liability",
    parentKey: "liabilities",
    allowPosting: true,
  },

  /* ==========================================================
   * حقوق الملكية
   * ========================================================== */

  {
    key: "equity",
    code: "3000",
    name: "حقوق الملكية",
    type: "equity",
    allowPosting: false,
  },

  {
    key: "capital",
    code: "3100",
    name: "رأس المال",
    type: "equity",
    parentKey: "equity",
    allowPosting: true,
  },

  {
    key: "retainedEarnings",
    code: "3200",
    name: "الأرباح المحتجزة",
    type: "equity",
    parentKey: "equity",
    allowPosting: true,
  },

  {
    key: "incomeSummary",
    code: "3300",
    name: "ملخص الدخل",
    type: "equity",
    parentKey: "equity",
    allowPosting: true,
  },

  /* ==========================================================
   * الإيرادات
   * ========================================================== */

  {
    key: "revenues",
    code: "4000",
    name: "الإيرادات",
    type: "revenue",
    allowPosting: false,
  },

  {
    key: "sales",
    code: "4100",
    name: "المبيعات",
    type: "revenue",
    parentKey: "revenues",
    allowPosting: true,
  },

  {
    key: "serviceRevenue",
    code: "4200",
    name: "إيرادات الخدمات",
    type: "revenue",
    parentKey: "revenues",
    allowPosting: true,
  },

  {
    key: "otherRevenue",
    code: "4300",
    name: "إيرادات أخرى",
    type: "revenue",
    parentKey: "revenues",
    allowPosting: true,
  },

  /* ==========================================================
   * المصروفات
   * ========================================================== */

  {
    key: "expenses",
    code: "5000",
    name: "المصروفات",
    type: "expense",
    allowPosting: false,
  },

  {
    key: "cogs",
    code: "5100",
    name: "تكلفة المبيعات",
    type: "expense",
    parentKey: "expenses",
    allowPosting: true,
  },

  {
    key: "operatingExpenses",
    code: "5200",
    name: "المصروفات التشغيلية",
    type: "expense",
    parentKey: "expenses",
    allowPosting: false,
  },

  {
    key: "administrativeExpenses",
    code: "5201",
    name: "المصروفات الإدارية",
    type: "expense",
    parentKey: "operatingExpenses",
    allowPosting: true,
  },

  {
    key: "transportExpenses",
    code: "5202",
    name: "مصروفات النقل",
    type: "expense",
    parentKey: "operatingExpenses",
    allowPosting: true,
  },

  {
    key: "followUpExpenses",
    code: "5203",
    name: "مصروفات المتابعة",
    type: "expense",
    parentKey: "operatingExpenses",
    allowPosting: true,
  },

  {
    key: "veterinaryExpenses",
    code: "5204",
    name: "المصروفات البيطرية",
    type: "expense",
    parentKey: "operatingExpenses",
    allowPosting: true,
  },

  {
    key: "otherExpenses",
    code: "5300",
    name: "مصروفات أخرى",
    type: "expense",
    parentKey: "expenses",
    allowPosting: true,
  },
];

/* ============================================================
 * Helpers
 * ============================================================ */

/**
 * التأكد من أن نوع الحساب موجود في ACCOUNT_TYPES.
 */
const validateSeedAccountType = (type: string): AccountType => {
  if (!ACCOUNT_TYPES.includes(type as AccountType)) {
    throw new Error(`SEED_INVALID_ACCOUNT_TYPE:${type}`);
  }

  return type as AccountType;
};

/**
 * التأكد من عدم وجود كود مكرر داخل الـSeed نفسه.
 */
const validateSeedAccountCodes = (): void => {
  const codes = new Set<string>();

  for (const account of DEFAULT_ACCOUNTS) {
    if (codes.has(account.code)) {
      throw new Error(`SEED_DUPLICATE_ACCOUNT_CODE:${account.code}`);
    }

    codes.add(account.code);
  }
};

/**
 * التأكد من أن كل Parent Key موجود.
 */
const validateSeedParents = (): void => {
  const keys = new Set(DEFAULT_ACCOUNTS.map((account) => account.key));

  for (const account of DEFAULT_ACCOUNTS) {
    if (account.parentKey && !keys.has(account.parentKey)) {
      throw new Error(`SEED_PARENT_NOT_FOUND:${account.parentKey}`);
    }
  }
};

/**
 * التحقق من أن الحسابات الأب ليست قابلة للترحيل.
 */
const validateSeedHierarchy = (): void => {
  const accountMap = new Map(
    DEFAULT_ACCOUNTS.map((account) => [account.key, account]),
  );

  for (const account of DEFAULT_ACCOUNTS) {
    if (account.parentKey) {
      const parent = accountMap.get(account.parentKey);

      if (!parent) {
        throw new Error(`SEED_PARENT_NOT_FOUND:${account.parentKey}`);
      }

      if (parent.allowPosting) {
        throw new Error(`SEED_PARENT_MUST_NOT_ALLOW_POSTING:${parent.key}`);
      }
    }
  }
};

/**
 * التحقق الكامل من بيانات الـSeed قبل التنفيذ.
 */
const validateSeedDefinition = (): void => {
  validateSeedAccountCodes();
  validateSeedParents();
  validateSeedHierarchy();

  for (const account of DEFAULT_ACCOUNTS) {
    validateSeedAccountType(account.type);
  }
};

/**
 * إنشاء حساب Seed واحد.
 */
const createSeedAccount = (
  account: SeedAccount,
  parentId: string | null,
): Promise<ChartOfAccount> =>
  accountsCollection.create((record) => {
    record.code = account.code;
    record.name = account.name;
    record.type = account.type;

    record.parentId = parentId;

    record.isActive = true;

    record.allowPosting = Boolean(account.allowPosting);

    record.isCashAccount = Boolean(account.isCashAccount);
  });

/* ============================================================
 * Existing Account Detection
 * ============================================================ */

/**
 * التحقق هل يوجد أي حساب في دليل الحسابات.
 */
const hasAnyAccounts = async (): Promise<boolean> => {
  const count = await accountsCollection.query().fetchCount();

  return count > 0;
};

/* ============================================================
 * Accounting Settings
 * ============================================================ */

/**
 * إنشاء إعدادات النظام اعتمادًا على الحسابات التي
 * تم إنشاؤها في الـSeed.
 */
const createDefaultAccountingSettings = async (
  accountsByKey: Map<string, ChartOfAccount>,
): Promise<AccountingSetting> => {
  const inventoryAccount = accountsByKey.get("inventory");

  const salesAccount = accountsByKey.get("sales");

  const cogsAccount = accountsByKey.get("cogs");

  const customersAccount = accountsByKey.get("customers");

  const suppliersAccount = accountsByKey.get("suppliers");

  const cashAccount = accountsByKey.get("mainCash");

  const bankAccount = accountsByKey.get("mainBank");

  const serviceRevenueAccount = accountsByKey.get("serviceRevenue");

  const incomeSummaryAccount = accountsByKey.get("incomeSummary");

  const retainedEarningsAccount = accountsByKey.get("retainedEarnings");

  if (
    !inventoryAccount ||
    !salesAccount ||
    !cogsAccount ||
    !customersAccount ||
    !suppliersAccount ||
    !cashAccount ||
    !bankAccount ||
    !serviceRevenueAccount ||
    !incomeSummaryAccount ||
    !retainedEarningsAccount
  ) {
    throw new Error("SEED_REQUIRED_ACCOUNT_NOT_FOUND");
  }

  return settingsCollection.create((settings) => {
    settings.inventoryAccountId = inventoryAccount.id;

    settings.salesAccountId = salesAccount.id;

    settings.cogsAccountId = cogsAccount.id;

    settings.customersAccountId = customersAccount.id;

    settings.suppliersAccountId = suppliersAccount.id;

    settings.cashDefaultAccountId = cashAccount.id;

    settings.bankDefaultAccountId = bankAccount.id;

    settings.serviceRevenueAccountId = serviceRevenueAccount.id;

    settings.incomeSummaryAccountId = incomeSummaryAccount.id;

    settings.retainedEarningsAccountId = retainedEarningsAccount.id;
  });
};

/* ============================================================
 * Public Seed Function
 * ============================================================ */

/**
 * تهيئة دليل الحسابات والإعدادات الافتراضية.
 *
 * القاعدة الأساسية:
 *
 * إذا كان هناك حساب واحد على الأقل في دليل الحسابات:
 * لا يتم إنشاء أي حسابات افتراضية.
 *
 * هذا يمنع تكرار الحسابات أو تعديل بيانات المستخدم.
 */
export const seedAccounting = async (): Promise<void> => {
  /**
   * لا نعيد Seed إذا كان الدليل يحتوي بيانات.
   */
  if (await hasAnyAccounts()) {
    return;
  }

  /**
   * التأكد من صحة تعريفات الحسابات قبل
   * بدء أي عملية كتابة.
   */
  validateSeedDefinition();

  await database.write(async () => {
    /**
     * Map:
     * key → WatermelonDB record
     */
    const accountsByKey = new Map<string, ChartOfAccount>();

    /**
     * إنشاء الحسابات بالترتيب.
     *
     * بما أن DEFAULT_ACCOUNTS مرتبة من الأب
     * إلى الأبناء، يمكن إنشاء الحسابات مباشرة.
     */
    for (const account of DEFAULT_ACCOUNTS) {
      let parentId: string | null = null;

      if (account.parentKey) {
        const parent = accountsByKey.get(account.parentKey);

        if (!parent) {
          throw new Error(`SEED_PARENT_RECORD_NOT_FOUND:${account.parentKey}`);
        }

        parentId = parent.id;
      }

      const createdAccount = await createSeedAccount(account, parentId);

      accountsByKey.set(account.key, createdAccount);
    }

    /**
     * إنشاء إعدادات المحاسبة الافتراضية.
     */
    await createDefaultAccountingSettings(accountsByKey);
  });
};

/* ============================================================
 * Optional Verification
 * ============================================================ */

/**
 * التحقق من أن الحسابات الأساسية للـSeed موجودة.
 *
 * مفيدة في الاختبارات أو عند فحص قاعدة البيانات.
 */
export const verifyAccountingSeed = async (): Promise<{
  accountsCount: number;
  settingsExists: boolean;
}> => {
  const accounts = await accountsCollection.query().fetch();

  const settings = await settingsCollection.query().fetch();

  return {
    accountsCount: accounts.length,
    settingsExists: settings.length > 0,
  };
};
