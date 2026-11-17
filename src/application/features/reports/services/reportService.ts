import { database, ProductUnit, SalesInvoice } from "src/database";
import Customer from "src/database/models/Customer";
import Product from "src/database/models/Product";
import JournalEntry from "src/database/models/JournalEntry"; // ðŸ‘ˆ Ø§Ø³ØªØ¨Ø¯Ø§Ù„ CreditEntry Ø¨Ù€ JournalEntry
import JournalEntryLine from "src/database/models/JournalEntryLine";
import ChartOfAccount from "src/database/models/ChartOfAccount";
import SalesInvoiceItem from "src/database/models/SalesInvoiceItem"; // ðŸ‘ˆ Ø§Ø³ØªØ¨Ø¯Ø§Ù„ BillItem Ø¨Ù€ SalesInvoiceItem
import { Q } from "@nozbe/watermelondb";
import { BILL_STATUSES } from "@core/constants";
import { formatDate } from "@shared/utils/date";
import { inventoryRepository } from "src/application/features/inventory/repositories/inventoryRepository";
import { customerRepository } from "src/application/features/customers/repositories/customerRepository";
import {
  SalesReportData,
  DailySales,
  CreditReportData,
  CustomerCreditInfo,
  InventoryReportData,
  ProductStockInfo,
  ProductPerformanceData,
} from "@core/types";

const salesInvoicesCollection = database.get<SalesInvoice>("sales_invoices");
const customersCollection = database.get<Customer>("customers");
const productsCollection = database.get<Product>("products");
const journalEntriesCollection = database.get<JournalEntry>("journal_entries"); // ðŸ‘ˆ ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¬Ø¯ÙˆÙ„
const salesInvoiceItemsCollection = database.get<SalesInvoiceItem>(
  "sales_invoice_items",
); // ðŸ‘ˆ ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¬Ø¯ÙˆÙ„
const journalEntryLinesCollection = database.get<JournalEntryLine>(
  "journal_entry_lines",
);
const accountsCollection = database.get<ChartOfAccount>("chart_of_accounts");

export interface JournalEntrySummary {
  id: string;
  entryDate: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdBy: string;
  status: string;
  isReversed: boolean;
  totalDebit: number;
  totalCredit: number;
}

export interface JournalEntryDetails extends JournalEntrySummary {
  lines: Array<{
    id: string;
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }>;
}

export interface LedgerRow {
  id: string;
  entryId: string;
  date: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface LedgerReport {
  openingBalance: number;
  rows: LedgerRow[];
  closingBalance: number;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
}

const summarizeEntry = async (
  entry: JournalEntry,
): Promise<JournalEntrySummary> => {
  const lines = await entry.lines.fetch();
  return {
    id: entry.id,
    entryDate: entry.entryDate,
    description: entry.description ?? "",
    referenceType: entry.referenceType ?? undefined,
    referenceId: entry.referenceId ?? undefined,
    createdBy: entry.createdBy,
    status: entry.status,
    isReversed: entry.isReversed,
    totalDebit: lines.reduce((sum, line) => sum + line.debit, 0),
    totalCredit: lines.reduce((sum, line) => sum + line.credit, 0),
  };
};

export const reportService = {
  getJournalEntries: async (
    search = "",
    from?: Date,
    to?: Date,
  ): Promise<JournalEntrySummary[]> => {
    const conditions: any[] = [];
    if (from) conditions.push(Q.where("entry_date", Q.gte(from.getTime())));
    if (to) conditions.push(Q.where("entry_date", Q.lte(to.getTime())));
    if (search.trim()) {
      const safeSearch = Q.sanitizeLikeString(search.trim());
      conditions.push(
        Q.or(
          Q.where("description", Q.like(`%${safeSearch}%`)),
          Q.where("reference_type", Q.like(`%${safeSearch}%`)),
          Q.where("reference_id", Q.like(`%${safeSearch}%`)),
        ),
      );
    }
    const entries = await journalEntriesCollection
      .query(...conditions, Q.sortBy("entry_date", Q.desc))
      .fetch();
    return Promise.all(entries.map(summarizeEntry));
  },

  getJournalEntryDetails: async (
    entryId: string,
  ): Promise<JournalEntryDetails> => {
    const entry = await journalEntriesCollection.find(entryId);
    const summary = await summarizeEntry(entry);
    const lines = await entry.lines.fetch();
    
    // جلب جميع الحسابات مرة واحدة للبحث فيها بدلاً من استخدام العلاقات
    const accountsCollection = database.get("chart_of_accounts");
    const allAccounts = await accountsCollection.query().fetch();
    const accountsMap = new Map(allAccounts.map(a => [a.id, a]));

    const detailedLines = await Promise.all(
      lines.map(async (line) => {
        // البحث المباشر عن الحساب باستخدام ID
        const account = accountsMap.get(line.accountId);
        return {
          id: line.id,
          accountId: line.accountId,
          accountCode: account ? account.code : "???",
          accountName: account ? account.name : "حساب غير معروف",
          debit: line.debit,
          credit: line.credit,
        };
      }),
    );
    return { ...summary, lines: detailedLines };
  },

  getAccountStatement: async (
    accountId: string,
    from?: Date,
    to?: Date,
  ): Promise<LedgerReport> => {
    const lineConditions = [Q.where("account_id", accountId)];
    const lines = await journalEntryLinesCollection
      .query(...lineConditions)
      .fetch();
    const lineEntryMap = new Map<string, JournalEntry>();
    for (const line of lines) {
      const entry = await line.journalEntry.fetch();
      lineEntryMap.set(line.id, entry);
    }
    const fromTime = from?.getTime() ?? Number.NEGATIVE_INFINITY;
    const toTime = to?.getTime() ?? Number.POSITIVE_INFINITY;
    const allRows = lines
      .map((line) => {
        const entry = lineEntryMap.get(line.id);
        return entry ? { line, entry } : null;
      })
      .filter(
        (value): value is { line: JournalEntryLine; entry: JournalEntry } =>
          value !== null,
      )
      .sort((a, b) => a.entry.entryDate - b.entry.entryDate);
    const openingBalance = allRows
      .filter(({ entry }) => entry.entryDate < fromTime)
      .reduce((sum, { line }) => sum + line.debit - line.credit, 0);
    let runningBalance = openingBalance;
    const rows = allRows
      .filter(
        ({ entry }) => entry.entryDate >= fromTime && entry.entryDate <= toTime,
      )
      .map(({ line, entry }) => {
        runningBalance += line.debit - line.credit;
        return {
          id: line.id,
          entryId: entry.id,
          date: entry.entryDate,
          description: entry.description ?? "",
          referenceType: entry.referenceType,
          referenceId: entry.referenceId,
          debit: line.debit,
          credit: line.credit,
          runningBalance,
        };
      });
    return { openingBalance, rows, closingBalance: runningBalance };
  },

  getGeneralLedger: async (accountId: string, from?: Date, to?: Date) =>
    reportService.getAccountStatement(accountId, from, to),

  getTrialBalance: async (to?: Date): Promise<TrialBalanceReport> => {
    const accounts = await accountsCollection
      .query(Q.where("is_active", true), Q.sortBy("code", Q.asc))
      .fetch();
    const lines = await journalEntryLinesCollection.query().fetch();
    const entries = new Map<string, JournalEntry>();
    for (const line of lines) {
      const entry = await line.journalEntry.fetch();
      entries.set(entry.id, entry);
    }
    const endTime = to?.getTime() ?? Number.POSITIVE_INFINITY;
    const totals = new Map<string, { debit: number; credit: number }>();
    for (const line of lines) {
      const entry = entries.get(line.journalEntry.id);
      if (!entry || entry.entryDate > endTime) continue;
      const current = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
      current.debit += line.debit;
      current.credit += line.credit;
      totals.set(line.accountId, current);
    }
    const rows = accounts.map((account) => {
      const total = totals.get(account.id) ?? { debit: 0, credit: 0 };
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        debit: total.debit,
        credit: total.credit,
        balance: total.debit - total.credit,
      };
    });
    const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
    return {
      rows,
      totalDebit,
      totalCredit,
      difference: totalDebit - totalCredit,
    };
  },

  getSalesReport: async (from: Date, to: Date): Promise<SalesReportData> => {
    const invoices = await salesInvoicesCollection
      .query(
        Q.where("created_at", Q.gte(from.getTime())),
        Q.where("created_at", Q.lte(to.getTime())),
        Q.where("status", Q.notEq(BILL_STATUSES.CANCELLED)),
      )
      .fetch();

    const totalSales = invoices.reduce(
      (sum: number, b: SalesInvoice) => sum + b.total,
      0,
    );
    const totalBills = invoices.length;
    const averageBill = totalBills > 0 ? totalSales / totalBills : 0;

    // Group by day
    const dailyMap = new Map<string, DailySales>();
    invoices.forEach((invoice: SalesInvoice) => {
      const dateKey = formatDate(invoice.createdAt);
      const existing = dailyMap.get(dateKey);
      if (existing) {
        existing.total += invoice.total;
        existing.billCount += 1;
      } else {
        dailyMap.set(dateKey, {
          date: dateKey,
          total: invoice.total,
          billCount: 1,
        });
      }
    });

    // Payment type breakdown
    const paymentBreakdown: Record<string, number> = {};
    invoices.forEach((invoice: SalesInvoice) => {
      const type = invoice.paymentType || "cash";
      paymentBreakdown[type] = (paymentBreakdown[type] || 0) + invoice.total;
    });

    return {
      totalSales,
      totalBills,
      averageBill,
      dailyBreakdown: Array.from(dailyMap.values()),
    };
  },

  getCreditReport: async (): Promise<CreditReportData> => {
    const customers = await customersCollection
      .query(Q.where("is_active", true))
      .fetch();

    const customerCredits: CustomerCreditInfo[] = [];
    let totalOutstanding = 0;

    for (const customer of customers) {
      const balance = await customerRepository.getOutstandingBalance(
        customer.id,
      );
      const entries = await journalEntriesCollection
        .query(
          Q.where("reference_id", customer.id),
          Q.sortBy("entry_date", Q.desc),
          Q.take(1),
        )
        .fetch();

      if (balance > 0) {
        customerCredits.push({
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          outstanding: balance,
          lastTransactionDate: formatDate(entries[0]?.createdAt || Date.now()),
        });
        totalOutstanding += balance;
      }
    }

    return {
      totalOutstanding,
      customers: customerCredits.sort((a, b) => b.outstanding - a.outstanding),
    };
  },

  getInventoryReport: async (): Promise<InventoryReportData> => {
    const products = await productsCollection
      .query(Q.where("is_active", true))
      .fetch();

    // ðŸ‘ˆ Ø¬Ù„Ø¨ Ø¬Ø¯ÙˆÙ„ Ø§Ù„ÙˆØ­Ø¯Ø§Øª Ù„Ø±Ø¨Ø· Ø§Ø³Ù… Ø§Ù„ÙˆØ­Ø¯Ø© Ø¨Ø§Ù„Ù…Ù†ØªØ¬
    const productUnitsCollection = database.get<ProductUnit>("product_units");

    const productInfos: ProductStockInfo[] = [];

    for (const p of products) {
      const currentStock = await inventoryRepository.getProductStock(p.id);
      const purchasePrice = p.lastPurchaseCost || 0;
      const isLowStock = currentStock <= p.minStock;
      const isOutOfStock = currentStock <= 0;

      // Ø¬Ù„Ø¨ Ø§Ù„ÙˆØ­Ø¯Ø© Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠØ© Ù„Ù„Ù…Ù†ØªØ¬ Ù…Ù† Ø¬Ø¯ÙˆÙ„ product_units
      const units = await productUnitsCollection
        .query(Q.where("product_id", p.id), Q.take(1))
        .fetch();
      const unitName = units.length > 0 ? units[0].unit.name : "";

      productInfos.push({
        id: p.id,
        name: p.name,
        category: "", // ÙŠÙ…ÙƒÙ†Ùƒ Ø¬Ù„Ø¨ Ø§Ø³Ù… Ø§Ù„ØªØµÙ†ÙŠÙ Ø£ÙŠØ¶Ø§Ù‹ Ø¥Ø°Ø§ Ø±ØºØ¨Øª
        currentStock,
        unit: unitName, // ðŸ‘ˆ ØªÙ…Ø±ÙŠØ± Ø§Ø³Ù… Ø§Ù„ÙˆØ­Ø¯Ø© Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ Ù‡Ù†Ø§ Ø¨Ø¯Ù„Ø§Ù‹ Ù…Ù† Ø§Ù„Ù†Øµ Ø§Ù„ÙØ§Ø±Øº
        purchasePrice,
        sellingPrice: 0,
        stockValue: currentStock * purchasePrice,
        isLowStock,
        isOutOfStock,
      });
    }

    const totalStockValue = productInfos.reduce(
      (sum: number, p: ProductStockInfo) => sum + p.stockValue,
      0,
    );
    const lowStockCount = productInfos.filter(
      (p: ProductStockInfo) => p.isLowStock,
    ).length;
    const outOfStockCount = productInfos.filter(
      (p: ProductStockInfo) => p.isOutOfStock,
    ).length;

    return {
      totalStockValue,
      lowStockCount,
      outOfStockCount,
      products: productInfos,
    };
  },

  getProductPerformance: async (
    from: Date,
    to: Date,
  ): Promise<ProductPerformanceData[]> => {
    const invoices = await salesInvoicesCollection
      .query(
        Q.where("created_at", Q.gte(from.getTime())),
        Q.where("created_at", Q.lte(to.getTime())),
        Q.where("status", Q.notEq(BILL_STATUSES.CANCELLED)),
      )
      .fetch();

    const invoiceIds = invoices.map((inv: SalesInvoice) => inv.id);
    if (invoiceIds.length === 0) {
      return [];
    }

    // ðŸ‘ˆ Ø§Ù„ØªØµØ­ÙŠØ­ Ù‡Ù†Ø§: Ø§Ø³ØªØ®Ø¯Ø§Ù… sales_invoice_id Ø¨Ø¯Ù„Ø§Ù‹ Ù…Ù† bill_id
    const invoiceItems = await salesInvoiceItemsCollection
      .query(Q.where("sales_invoice_id", Q.oneOf(invoiceIds)))
      .fetch();

    const performanceMap = new Map<string, ProductPerformanceData>();

    invoiceItems.forEach((item: SalesInvoiceItem) => {
      // Ù…Ù„Ø§Ø­Ø¸Ø©: Ø¨Ù…Ø§ Ø£Ù† Ø§Ù„Ù†Ù…ÙˆØ°Ø¬ Ù„Ø§ ÙŠØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ø­Ù‚Ù„ productName Ø¨Ø´ÙƒÙ„ Ù…Ø¨Ø§Ø´Ø± (Ø¨Ù„ ÙŠØ¹ØªÙ…Ø¯ Ø¹Ù„Ù‰ Ø§Ù„Ø¹Ù„Ø§Ù‚Ø© product)ØŒ
      // ØªØ£ÙƒØ¯ Ù…Ù† Ø¬Ù„Ø¨ Ø§Ù„Ø§Ø³Ù… Ø£Ùˆ Ø§Ù„ØªØ¹Ø§Ù…Ù„ Ù…Ø¹Ù‡ Ø¨Ø­Ø°Ø±. Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„Ø¬Ø¯ÙˆÙ„ Ø£Ùˆ Ø§Ù„Ù€ item ÙŠØ­ÙØ¸ Ø§Ù„Ø§Ø³Ù…ØŒ Ø§Ø³ØªÙ…Ø± Ù‡ÙƒØ°Ø§ØŒ
      // ÙˆØ¥Ù„Ø§ ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ø³ØªØ®Ø¯Ø§Ù… item.product?.name Ø¥Ø°Ø§ ØªÙ… Ø¹Ù…Ù„ fetch Ù„Ù„Ø¹Ù„Ø§Ù‚Ø§Øª.
      const productId = (item as any).product?.id ?? (item as any).productId ?? "unknown";
      const existing = performanceMap.get(productId);

      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue += item.total;
      } else {
        performanceMap.set(productId, {
          id: productId,
          name: "Product", // Ø£Ùˆ Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬ Ø§Ù„Ù…Ø±ØªØ¨Ø· Ø¥Ø°Ø§ ÙƒØ§Ù† Ù…ØªØ§Ø­Ø§Ù‹
          quantitySold: item.quantity,
          revenue: item.total,
        });
      }
    });

    return Array.from(performanceMap.values()).sort(
      (a, b) => b.revenue - a.revenue,
    );
  },
};


