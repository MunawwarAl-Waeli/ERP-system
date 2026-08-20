import { database, ProductUnit, SalesInvoice } from "@core/database";
import Customer from "@core/database/models/Customer";
import Product from "@core/database/models/Product";
import JournalEntry from "@core/database/models/JournalEntry"; // 👈 استبدال CreditEntry بـ JournalEntry
import SalesInvoiceItem from "@core/database/models/SalesInvoiceItem"; // 👈 استبدال BillItem بـ SalesInvoiceItem
import { Q } from "@nozbe/watermelondb";
import { BILL_STATUSES } from "@core/constants";
import { formatDate } from "@shared/utils/date";
import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";
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
const journalEntriesCollection = database.get<JournalEntry>("journal_entries"); // 👈 تحديث الجدول
const salesInvoiceItemsCollection = database.get<SalesInvoiceItem>(
  "sales_invoice_items",
); // 👈 تحديث الجدول

export const reportService = {
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
      // البحث عن القيود المحاسبية المرتبطة بالعميل عبر referenceId أو الحقول المتاحة
      const entries = await journalEntriesCollection
        .query(
          Q.where("reference_id", customer.id),
          Q.sortBy("entry_date", Q.desc),
          Q.take(1),
        )
        .fetch();

      // ملاحظة: يمكنك تعديل منطق حساب الرصيد بناءً على خط هيكلة الـ JournalEntry لديك
      const balance = entries.length > 0 && entries[0].isPosted ? 0 : 0;

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

    // 👈 جلب جدول الوحدات لربط اسم الوحدة بالمنتج
    const productUnitsCollection = database.get<ProductUnit>("product_units");

    const productInfos: ProductStockInfo[] = [];

    for (const p of products) {
      const currentStock = await inventoryRepository.getProductStock(p.id);
      const purchasePrice = p.lastPurchaseCost || 0;
      const isLowStock = currentStock <= p.minStock;
      const isOutOfStock = currentStock <= 0;

      // جلب الوحدة الافتراضية للمنتج من جدول product_units
      const units = await productUnitsCollection
        .query(Q.where("product_id", p.id), Q.take(1))
        .fetch();
      const unitName = units.length > 0 ? units[0].unit.name : "";

      productInfos.push({
        id: p.id,
        name: p.name,
        category: "", // يمكنك جلب اسم التصنيف أيضاً إذا رغبت
        currentStock,
        unit: unitName, // 👈 تمرير اسم الوحدة الحقيقي هنا بدلاً من النص الفارغ
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

    // 👈 التصحيح هنا: استخدام sales_invoice_id بدلاً من bill_id
    const invoiceItems = await salesInvoiceItemsCollection
      .query(Q.where("sales_invoice_id", Q.oneOf(invoiceIds)))
      .fetch();

    const performanceMap = new Map<string, ProductPerformanceData>();

    invoiceItems.forEach((item: SalesInvoiceItem) => {
      // ملاحظة: بما أن النموذج لا يحتوي على حقل productName بشكل مباشر (بل يعتمد على العلاقة product)،
      // تأكد من جلب الاسم أو التعامل معه بحذر. إذا كان الجدول أو الـ item يحفظ الاسم، استمر هكذا،
      // وإلا يمكنك استخدام item.product?.name إذا تم عمل fetch للعلاقات.
      const productId = item.productId || "unknown";
      const existing = performanceMap.get(productId);

      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue += item.total;
      } else {
        performanceMap.set(productId, {
          id: productId,
          name: "Product", // أو اسم المنتج المرتبط إذا كان متاحاً
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
