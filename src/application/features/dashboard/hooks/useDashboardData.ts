/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { database, SalesInvoice } from "src/database";
import Customer from "src/database/models/Customer";
import Product from "src/database/models/Product";
import { Q } from "@nozbe/watermelondb";
import {
  getStartOfDay,
  getEndOfDay,
  getStartOfMonth,
} from "@shared/utils/date";
import { BILL_STATUSES } from "@core/constants";
import { inventoryRepository } from "src/application/features/inventory/repositories/inventoryRepository";

interface DashboardData {
  todaySales: number;
  todayBillCount: number;
  monthSales: number;
  totalCustomers: number;
  totalUdhar: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  recentBills: SalesInvoice[];
  isLoading: boolean;
}

// Ø¯Ø§Ù„Ø© Ù…Ø³ØªÙ‚Ù„Ø© Ù„Ø­Ø³Ø§Ø¨ Ø§Ù„Ø¯ÙŠÙˆÙ† Ø§Ù„Ù…Ø³ØªØ­Ù‚Ø© Ù„ØªÙ‚Ù„ÙŠÙ„ Ø§Ù„ØªØ¹Ù‚ÙŠØ¯ ÙˆØªØ¬Ù†Ø¨ Ø§Ù„ØªØ¯Ø§Ø®Ù„ Ø§Ù„Ø¹Ù…ÙŠÙ‚
const calculateTotalUdhar = async (billsCollection: any): Promise<number> => {
  const unpaidBills = await billsCollection
    .query(
      Q.where("status", Q.notEq(BILL_STATUSES.CANCELLED)),
      Q.where("payment_type", Q.oneOf(["credit", "partial"])),
    )
    .fetch();

  let total = 0;
  for (const bill of unpaidBills) {
    total += (bill.total || 0) - (bill.paidAmount || 0);
  }
  return total;
};

// Ø¯Ø§Ù„Ø© Ù…Ø³ØªÙ‚Ù„Ø© Ù„Ø­Ø³Ø§Ø¨ Ø­Ø§Ù„Ø© Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
const calculateStockStatus = async (productsCollection: any) => {
  const allProducts = await productsCollection
    .query(Q.where("is_active", true))
    .fetch();
  let lowStock = 0;
  let outOfStock = 0;

  for (const product of allProducts) {
    const stock = await inventoryRepository.getProductStock(product.id);
    if (stock <= 0) {
      outOfStock++;
    } else if (stock <= (product.minStock || 0)) {
      lowStock++;
    }
  }

  return { lowStock, outOfStock };
};

export const useDashboardData = (): DashboardData => {
  const [data, setData] = useState<DashboardData>({
    todaySales: 0,
    todayBillCount: 0,
    monthSales: 0,
    totalCustomers: 0,
    totalUdhar: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    recentBills: [],
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = async () => {
      try {
        const now = new Date();
        const todayStart = getStartOfDay(now).valueOf();
        const todayEnd = getEndOfDay(now).valueOf();
        const monthStart = getStartOfMonth(now).valueOf();

        const billsCollection = database.get<SalesInvoice>("sales_invoices");
        const customersCollection = database.get<Customer>("customers");
        const productsCollection = database.get<Product>("products");
        

        // Ù…Ø¨ÙŠØ¹Ø§Øª Ø§Ù„ÙŠÙˆÙ…
        const todayBills = await billsCollection
          .query(
            Q.where("created_at", Q.gte(todayStart)),
            Q.where("created_at", Q.lte(todayEnd)),
            Q.where("status", Q.notEq(BILL_STATUSES.CANCELLED)),
          )
          .fetch();

        const todaySales = todayBills.reduce(
          (sum, bill) => sum + (bill.total || 0),
          0,
        );

        // Ù…Ø¨ÙŠØ¹Ø§Øª Ø§Ù„Ø´Ù‡Ø±
        const monthBills = await billsCollection
          .query(
            Q.where("created_at", Q.gte(monthStart)),
            Q.where("status", Q.notEq(BILL_STATUSES.CANCELLED)),
          )
          .fetch();

        const monthSales = monthBills.reduce(
          (sum, bill) => sum + (bill.total || 0),
          0,
        );

        // Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ Ø§Ù„Ù†Ø´Ø·ÙŠÙ†
        const activeCustomers = await customersCollection
          .query(Q.where("is_active", true))
          .fetchCount();

        // Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø¯ÙŠÙˆÙ† Ø§Ù„Ù…Ø³ØªØ­Ù‚Ø©
        const totalUdhar = await calculateTotalUdhar(billsCollection);

        // Ø­Ø§Ù„Ø© Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
        const { lowStock, outOfStock } = await calculateStockStatus(
          productsCollection,
        );

        // Ø£Ø­Ø¯Ø« Ø§Ù„ÙÙˆØ§ØªÙŠØ±
        const recentBills = await billsCollection
          .query(Q.sortBy("created_at", Q.desc), Q.take(5))
          .fetch();

        if (isMounted) {
          setData({
            todaySales,
            todayBillCount: todayBills.length,
            monthSales,
            totalCustomers: activeCustomers,
            totalUdhar,
            lowStockProducts: lowStock,
            outOfStockProducts: outOfStock,
            recentBills,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        if (isMounted) {
          setData((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    loadDashboardData();

    // Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª Ù„ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù„ÙˆØ­Ø© ÙÙˆØ±ÙŠØ§Ù‹
    const billsSub = database
      .get<SalesInvoice>("sales_invoices")
      .query()
      .observe()
      .subscribe(loadDashboardData);
    const productsSub = database
      .get<Product>("products")
      .query()
      .observe()
      .subscribe(loadDashboardData);
    const creditSub = database
      .get("journal_entries")
      .query()
      .observe()
      .subscribe(loadDashboardData);
    const customersSub = database
      .get<Customer>("customers")
      .query()
      .observe()
      .subscribe(loadDashboardData);

    return () => {
      isMounted = false;
      billsSub.unsubscribe();
      productsSub.unsubscribe();
      creditSub.unsubscribe();
      customersSub.unsubscribe();
    };
  }, []);

  return data;
};

