import { Model } from '@nozbe/watermelondb';
import {
  field,
  date,
  readonly,
  immutableRelation,
  writer,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class AccountingSetting extends Model {
  static table = 'accounting_settings';

  static associations: Associations = {
    chart_of_accounts: { type: 'belongs_to' as const, key: 'inventory_account_id' },
  };

  @field('inventory_account_id') inventoryAccountId!: string;
  @field('sales_account_id') salesAccountId!: string;
  @field('cogs_account_id') cogsAccountId!: string;
  @field('customers_account_id') customersAccountId!: string;
  @field('suppliers_account_id') suppliersAccountId!: string;
  @field('cash_default_account_id') cashDefaultAccountId!: string;
  @field('bank_default_account_id') bankDefaultAccountId?: string | null;
  @field('service_revenue_account_id') serviceRevenueAccountId?: string | null;
  @field('income_summary_account_id') incomeSummaryAccountId?: string | null;
  @field('retained_earnings_account_id') retainedEarningsAccountId?: string | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('chart_of_accounts', 'inventory_account_id') inventoryAccount: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('chart_of_accounts', 'sales_account_id') salesAccount: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('chart_of_accounts', 'cogs_account_id') cogsAccount: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('chart_of_accounts', 'customers_account_id') customersAccount: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('chart_of_accounts', 'suppliers_account_id') suppliersAccount: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('chart_of_accounts', 'cash_default_account_id') cashDefaultAccount: any;

  @writer async updateSettings(data: {
    inventoryAccountId?: string;
    salesAccountId?: string;
    cogsAccountId?: string;
    customersAccountId?: string;
    suppliersAccountId?: string;
    cashDefaultAccountId?: string;
    bankDefaultAccountId?: string | null;
    serviceRevenueAccountId?: string | null;
    incomeSummaryAccountId?: string | null;
    retainedEarningsAccountId?: string | null;
  }) {
    await this.update((setting: AccountingSetting) => {
      if (data.inventoryAccountId !== undefined) { setting.inventoryAccountId = data.inventoryAccountId; }
      if (data.salesAccountId !== undefined) { setting.salesAccountId = data.salesAccountId; }
      if (data.cogsAccountId !== undefined) { setting.cogsAccountId = data.cogsAccountId; }
      if (data.customersAccountId !== undefined) { setting.customersAccountId = data.customersAccountId; }
      if (data.suppliersAccountId !== undefined) { setting.suppliersAccountId = data.suppliersAccountId; }
      if (data.cashDefaultAccountId !== undefined) { setting.cashDefaultAccountId = data.cashDefaultAccountId; }
      if (data.bankDefaultAccountId !== undefined) { setting.bankDefaultAccountId = data.bankDefaultAccountId; }
      if (data.serviceRevenueAccountId !== undefined) { setting.serviceRevenueAccountId = data.serviceRevenueAccountId; }
      if (data.incomeSummaryAccountId !== undefined) { setting.incomeSummaryAccountId = data.incomeSummaryAccountId; }
      if (data.retainedEarningsAccountId !== undefined) { setting.retainedEarningsAccountId = data.retainedEarningsAccountId; }
    });
  }
}
