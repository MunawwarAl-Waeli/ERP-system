// src/core/services/accounting/SalesAccountingService.ts
import SalesInvoice from "src/database/models/SalesInvoice";
import SalesInvoiceItem from "src/database/models/SalesInvoiceItem";
import JournalEntry from "src/database/models/JournalEntry";
import { database } from "src/database";
import { Model, Q } from "@nozbe/watermelondb";
import { JournalService, JournalLineInput } from "./JournalService";
import { AccountingSettingsService } from "./AccountingSettingsService";

export const SalesAccountingService = {
  /**
   * تحضير قيد المبيعات
   */
  prepareSalesEntry: async (
    invoice: SalesInvoice,
    items: SalesInvoiceItem[],
    preparedCogsAmount = 0,
  ) => {
    const settings = await AccountingSettingsService.getSettings();

    let productRevenue = 0;
    let serviceRevenue = 0;
    let cogsAmount = 0;

    for (const item of items) {
      if ((item as any).itemType === "product") {
        productRevenue += item.total;
        cogsAmount += item.costAtSale;
        continue;
      }

      if ((item as any).itemType === "service") {
        serviceRevenue += item.total;
        continue;
      }
    }

    // FIFO prepares total cost before the journal is built, while costAtSale
    // is persisted in the same database batch. Prefer the prepared total so
    // the journal never reads stale item model values.
    cogsAmount = preparedCogsAmount > 0 ? preparedCogsAmount : cogsAmount;

    // Invoice-level discounts/fees are not stored as separate columns.
    // Normalize revenue lines to the persisted invoice total so the journal
    // remains balanced without inventing a second source of truth.
    serviceRevenue = Math.min(serviceRevenue, invoice.total);
    productRevenue = Math.max(invoice.total - serviceRevenue, 0);

    const paidAmount = invoice.paidAmount ?? 0;
    const remainingAmount = Math.max(invoice.total - paidAmount, 0);
    const lines: JournalLineInput[] = [];

    if (paidAmount > 0) {
      lines.push({
        accountId: settings.cashAccountId,
        debit: paidAmount,
        credit: 0,
      });
    }
    if (remainingAmount > 0) {
      lines.push({
        accountId: settings.customersAccountId,
        debit: remainingAmount,
        credit: 0,
      });
    }

    if (productRevenue > 0) {
      lines.push({
        accountId: settings.salesAccountId,
        debit: 0,
        credit: productRevenue,
      });
    }

    if (serviceRevenue > 0) {
      lines.push({
        accountId: settings.serviceRevenueAccountId,
        debit: 0,
        credit: serviceRevenue,
      });
    }

    if (cogsAmount > 0) {
      lines.push({
        accountId: settings.cogsAccountId,
        debit: cogsAmount,
        credit: 0,
      });
      lines.push({
        accountId: settings.inventoryAccountId,
        debit: 0,
        credit: cogsAmount,
      });
    }

    return JournalService.prepareCreateEntry({
      entryDate: invoice.invoiceDate,
      description: `فاتورة بيع رقم ${invoice.invoiceNumber ?? invoice.id}`,
      lines,
      referenceType: "sales_invoice",
      referenceId: invoice.id,
      createdBy: invoice.createdBy,
      idempotencyKey: `sales-invoice:${invoice.id}`,
    });
  },

  /**
   * تحضير قيد عكسي عند الإلغاء
   */
  prepareReverseSalesEntry: async (invoice: SalesInvoice): Promise<Model[]> => {
    const journalEntries = await database
      .get<JournalEntry>("journal_entries")
      .query(
        Q.where("reference_type", "sales_invoice"),
        Q.where("reference_id", invoice.id),
      )
      .fetch();

    if (journalEntries.length === 0) {
      return [];
    }

    const originalEntry = journalEntries[0];
    const reversal = await JournalService.prepareReverseEntry(
      originalEntry,
      `عكس قيد فاتورة ملغاة رقم ${invoice.invoiceNumber ?? invoice.id}`,
      {
        createdBy: invoice.createdBy,
        idempotencyKey: `sales-invoice-reversal:${invoice.id}`,
      },
      Date.now(),
    );
    return reversal.operations;
  },
};
