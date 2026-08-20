// src/core/services/accounting/SalesAccountingService.ts
import SalesInvoice from "@core/database/models/SalesInvoice";
import SalesInvoiceItem from "@core/database/models/SalesInvoiceItem";
import JournalEntry from "@core/database/models/JournalEntry";
import { database } from "@core/database";
import { Q } from "@nozbe/watermelondb";
import { JournalService, JournalLineInput } from "./JournalService";
import { AccountingSettingsService } from "./AccountingSettingsService";

export const SalesAccountingService = {
  /**
   * تحضير قيد المبيعات
   */
  prepareSalesEntry: async (
    invoice: SalesInvoice,
    items: SalesInvoiceItem[],
  ) => {
    const settings = await AccountingSettingsService.getSettings();

    let productRevenue = 0;
    let serviceRevenue = 0;
    let cogsAmount = 0;

    for (const item of items) {
      if (item.itemType === "product") {
        productRevenue += item.total;
        cogsAmount += item.costAtSale * item.quantity;
        continue;
      }

      if (item.itemType === "service") {
        serviceRevenue += item.total;
        continue;
      }
    }

    const lines: JournalLineInput[] = [
      {
        accountId: invoice.customerId
          ? settings.customersAccountId
          : settings.cashAccountId,
        debit: invoice.total,
        credit: 0,
      },
    ];

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
      date: invoice.invoiceDate,
      description: `فاتورة بيع رقم ${invoice.invoiceNumber ?? invoice.id}`,
      lines,
      referenceType: "sales_invoice",
      referenceId: invoice.id,
      createdBy: invoice.createdBy,
    });
  },

  /**
   * تحضير قيد عكسي عند الإلغاء
   */
  prepareReverseSalesEntry: async (invoice: SalesInvoice) => {
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
    return JournalService.prepareReverseEntry(
      originalEntry,
      `عكس قيد فاتورة ملغاة رقم ${invoice.invoiceNumber ?? invoice.id}`,
      invoice.createdBy,
    );
  },
};
