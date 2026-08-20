/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { database, SalesInvoice } from "@core/database";
import Customer from "@core/database/models/Customer";
import Product from "@core/database/models/Product";
import { Q } from "@nozbe/watermelondb";
import {
  getStartOfDay,
  getEndOfDay,
  getStartOfMonth,
} from "@shared/utils/date";
import { BILL_STATUSES } from "@core/constants";
import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";

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

// دالة مستقلة لحساب الديون المستحقة لتقليل التعقيد وتجنب التداخل العميق
const calculateTotalUdhar = async (
  customersCollection: any,
  creditEntriesCollection: any,
): Promise<number> => {
  const allCustomers = await customersCollection
    .query(Q.where("is_active", true))
    .fetch();
  let total = 0;

  for (const customer of allCustomers) {
    const latestEntries = await creditEntriesCollection
      .query(
        Q.where("customer_id", customer.id),
        Q.sortBy("created_at", Q.desc),
        Q.take(1),
      )
      .fetch();

    if (latestEntries.length > 0) {
      const entry = latestEntries[0] as unknown as { balanceAfter?: number };
      total += entry.balanceAfter || 0;
    }
  }

  return total;
};

// دالة مستقلة لحساب حالة المخزون
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
        const creditEntriesCollection = database.get("journal_entries");

        // مبيعات اليوم
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

        // مبيعات الشهر
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

        // إجمالي العملاء النشطين
        const activeCustomers = await customersCollection
          .query(Q.where("is_active", true))
          .fetchCount();

        // إجمالي الديون المستحقة
        const totalUdhar = await calculateTotalUdhar(
          customersCollection,
          creditEntriesCollection,
        );

        // حالة المخزون
        const { lowStock, outOfStock } = await calculateStockStatus(
          productsCollection,
        );

        // أحدث الفواتير
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

    // الاشتراكات لتحديث اللوحة فورياً
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
