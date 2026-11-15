import { database } from "src/database";
import { WatermelonUnitOfWork } from "@infrastructure/watermelon/WatermelonUnitOfWork";
import { WatermelonCustomerRepository } from "@infrastructure/watermelon/repositories/WatermelonCustomerRepository";
import { WatermelonInventoryRepository } from "@infrastructure/watermelon/repositories/WatermelonInventoryRepository";
import { WatermelonProductRepository } from "@infrastructure/watermelon/repositories/WatermelonProductRepository";
import { WatermelonSalesInvoiceRepository } from "@infrastructure/watermelon/repositories/WatermelonSalesInvoiceRepository";
import { WatermelonPurchaseInvoiceRepository } from "@infrastructure/watermelon/repositories/WatermelonPurchaseInvoiceRepository";
import { WatermelonReceiptVoucherRepository } from "@infrastructure/watermelon/repositories/WatermelonReceiptVoucherRepository";
import { WatermelonPaymentVoucherRepository } from "@infrastructure/watermelon/repositories/WatermelonPaymentVoucherRepository";
import { WatermelonAccountingSettingRepository } from "@infrastructure/watermelon/repositories/WatermelonAccountingSettingRepository";
import { WatermelonAccountingPeriodRepository } from "@infrastructure/watermelon/repositories/WatermelonAccountingPeriodRepository";
import { WatermelonChartOfAccountRepository } from "@infrastructure/watermelon/repositories/WatermelonChartOfAccountRepository";
import { WatermelonJournalEntryRepository } from "@infrastructure/watermelon/repositories/WatermelonJournalEntryRepository";
import { WatermelonUnitRepository } from "@infrastructure/watermelon/repositories/WatermelonUnitRepository";
import { WatermelonSupplierRepository } from "@infrastructure/watermelon/repositories/WatermelonSupplierRepository";
import { WatermelonDocumentNumberGenerator } from "@infrastructure/numbering/WatermelonDocumentNumberGenerator";

import { SalesInvoiceServiceImpl } from "@application/features/sales/services/SalesInvoiceService";
import { PurchaseInvoiceServiceImpl } from "@application/features/purchase/services/PurchaseInvoiceService";
import { ReceiptVoucherServiceImpl } from "@application/features/sales/services/ReceiptVoucherService";
import { PaymentVoucherServiceImpl } from "@application/features/purchase/services/PaymentVoucherService";
import { ExpenseServiceImpl } from "@application/features/expenses/services/ExpenseService";
import { CustomerServiceImpl } from "@application/features/customers/services/CustomerService";
import { SupplierServiceImpl } from "@application/features/suppliers/services/SupplierService";
import { DefaultProductService } from "@application/features/inventory/services/ProductService";
import { DefaultUnitService } from "@application/features/inventory/services/UnitService";
import { AccountingPeriodServiceImpl } from "@application/features/accounting/services/AccountingPeriodService";
import { ChartOfAccountServiceImpl } from "@application/features/accounting/services/ChartOfAccountServiceImpl";
import { seedAccounting } from "src/database/seeders/accountingSeed";

// ─────────────────────────────────────────────────────────────
// Unit of Work
// ─────────────────────────────────────────────────────────────
export const unitOfWork = new WatermelonUnitOfWork(database);

// ─────────────────────────────────────────────────────────────
// Repositories
// ─────────────────────────────────────────────────────────────
export const repositories = {
  customer: new WatermelonCustomerRepository(database),
  supplier: new WatermelonSupplierRepository(database),
  product: new WatermelonProductRepository(database),
  inventory: new WatermelonInventoryRepository(database),
  unit: new WatermelonUnitRepository(database),
  salesInvoice: new WatermelonSalesInvoiceRepository(database),
  purchaseInvoice: new WatermelonPurchaseInvoiceRepository(database),
  receiptVoucher: new WatermelonReceiptVoucherRepository(database),
  paymentVoucher: new WatermelonPaymentVoucherRepository(database),
  accountingSetting: new WatermelonAccountingSettingRepository(database),
  accountingPeriod: new WatermelonAccountingPeriodRepository(database),
  chartOfAccount: new WatermelonChartOfAccountRepository(database),
  journalEntry: new WatermelonJournalEntryRepository(database),
};

export type RepositoryRegistry = typeof repositories;

// ─────────────────────────────────────────────────────────────
// Document Number Generator
// ─────────────────────────────────────────────────────────────
export const documentNumberGenerator = new WatermelonDocumentNumberGenerator(
  database,
);

// ─────────────────────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────────────────────
export const services = {
  salesInvoice: new SalesInvoiceServiceImpl(
    repositories.salesInvoice,
    repositories.customer,
    repositories.product,
    repositories.inventory,
    repositories.journalEntry,
    repositories.accountingSetting,
    repositories.accountingPeriod,
    documentNumberGenerator,
    unitOfWork,
  ),

  purchaseInvoice: new PurchaseInvoiceServiceImpl({
    unitOfWork,
    purchaseInvoiceRepository: repositories.purchaseInvoice,
    productRepository: repositories.product,
    inventoryRepository: repositories.inventory,
    paymentVoucherRepository: repositories.paymentVoucher,
    journalEntryRepository: repositories.journalEntry,
    accountingSettingRepository: repositories.accountingSetting,
    documentNumberGenerator,
  }),

  receiptVoucher: new ReceiptVoucherServiceImpl({
    unitOfWork,
    receiptVoucherRepository: repositories.receiptVoucher,
    salesInvoiceRepository: repositories.salesInvoice,
    accountingSettingRepository: repositories.accountingSetting,
    journalEntryRepository: repositories.journalEntry,
    documentNumberGenerator,
  }),

  paymentVoucher: new PaymentVoucherServiceImpl({
    unitOfWork,
    paymentVoucherRepository: repositories.paymentVoucher,
    purchaseInvoiceRepository: repositories.purchaseInvoice,
    journalEntryRepository: repositories.journalEntry,
    accountingSettingRepository: repositories.accountingSetting,
    documentNumberGenerator,
  }),

  expense: new ExpenseServiceImpl(),

  customer: new CustomerServiceImpl({
    customerRepository: repositories.customer,
    unitOfWork,
  }),

  supplier: new SupplierServiceImpl(repositories.supplier, unitOfWork),

  product: new DefaultProductService({
    unitOfWork,
    productRepository: repositories.product,
    unitRepository: repositories.unit,
    accountingSettingRepository: repositories.accountingSetting,
  }),

  unit: new DefaultUnitService({
    unitOfWork,
    unitRepository: repositories.unit,
  }),

  accountingPeriod: new AccountingPeriodServiceImpl(
    repositories.accountingPeriod,
    unitOfWork,
  ),

  chartOfAccount: new ChartOfAccountServiceImpl(repositories.chartOfAccount),
};

export type ServiceRegistry = typeof services;

// ─────────────────────────────────────────────────────────────
// Startup initialization
// ─────────────────────────────────────────────────────────────
export async function initializeApplication(): Promise<void> {
  // Step 1: Seed accounts. seedAccounting has its own transaction internally.
  await seedAccounting();

  // Step 2: Ensure an accounting period exists.
  // Note: accountingPeriod.create uses database.batch which needs an active writer,
  // so we wrap it in unitOfWork.execute. This is a SEPARATE transaction from Step 1,
  // which avoids the nested-writer deadlock that was freezing the app.
  const anyPeriod = await repositories.accountingPeriod.get();

  if (!anyPeriod) {
    const year = new Date().getFullYear();
    try {
      await unitOfWork.execute(async () => {
        await repositories.accountingPeriod.create({
          name: `السنة المالية ${year}`,
          startDate: `${year}-01-01`,
          endDate: `${year}-12-31`,
        });
      });
    } catch (error) {
      const check = await repositories.accountingPeriod.get();
      if (!check) throw error;
      // Otherwise: created concurrently, ignore
    }
  }
}

