export interface AccountingSettingData {
  id: string;

  customersAccountId: string;
  suppliersAccountId: string;

  cashDefaultAccountId: string;
  bankDefaultAccountId?: string;

  incomeSummaryAccountId?: string;
  retainedEarningsAccountId?: string;

  // ✅ الحسابات الافتراضية للمنتجات بدون تصنيف
  inventoryDefaultAccountId?: string;
  salesDefaultAccountId?: string;
  cogsDefaultAccountId?: string;

  createdAt: number;
  updatedAt: number;
}

