import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { Platform } from "react-native";

import { schema } from "./schema";
import { migrations } from "./migrations";

// ─────────────────────────────────────────────────────────────
// Accounting
// ─────────────────────────────────────────────────────────────
import AccountingPeriod from "./models/AccountingPeriod";
import ChartOfAccount from "./models/ChartOfAccount";
import AccountingSetting from "./models/AccountingSetting";
import JournalEntry from "./models/JournalEntry";
import JournalEntryLine from "./models/JournalEntryLine";

// ─────────────────────────────────────────────────────────────
// Parties
// ─────────────────────────────────────────────────────────────
import Customer from "./models/Customer";
import Expense from "./models/Expense";
import Supplier from "./models/Supplier";

// ─────────────────────────────────────────────────────────────
// Products & Inventory
// ─────────────────────────────────────────────────────────────
import Category from "./models/Category";
import Unit from "./models/Unit";
import Product from "./models/Product";
import ProductUnit from "./models/ProductUnit";
import ProductBatch from "./models/ProductBatch";
import StockMovement from "./models/StockMovement";

// ─────────────────────────────────────────────────────────────
// Purchases
// ─────────────────────────────────────────────────────────────
import PurchaseInvoice from "./models/PurchaseInvoice";
import PurchaseInvoiceItem from "./models/PurchaseInvoiceItem";
import PaymentVoucher from "./models/PaymentVoucher";
import PaymentAllocation from "./models/PaymentAllocation";

// ─────────────────────────────────────────────────────────────
// Sales
// ─────────────────────────────────────────────────────────────
import SalesInvoice from "./models/SalesInvoice";
import SalesInvoiceItem from "./models/SalesInvoiceItem";
import SaleItemBatchConsumption from "./models/SaleItemBatchConsumption";
import ReceiptVoucher from "./models/ReceiptVoucher";
import ReceiptAllocation from "./models/ReceiptAllocation";

// ─────────────────────────────────────────────────────────────
// Sales Returns
// ─────────────────────────────────────────────────────────────
import SalesReturn from "./models/SalesReturn";
import SalesReturnItem from "./models/SalesReturnItem";
import SalesReturnBatchAllocation from "./models/SalesReturnBatchAllocation";
import CustomerRefund from "./models/CustomerRefund";

// ─────────────────────────────────────────────────────────────
// SQLite Adapter
// ─────────────────────────────────────────────────────────────

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: Platform.OS === "ios",

  onSetUpError: (error) => {
    console.error("Database setup error:", error);
  },
});

// ─────────────────────────────────────────────────────────────
// Database
// ─────────────────────────────────────────────────────────────

export const database = new Database({
  adapter,

  modelClasses: [
    // Accounting
    AccountingPeriod,
    ChartOfAccount,
    AccountingSetting,
    JournalEntry,
    JournalEntryLine,

    // Parties
    Customer,
    Supplier,
    Expense,

    // Products & Inventory
    Category,
    Unit,
    Product,
    ProductUnit,
    ProductBatch,
    StockMovement,

    // Purchases
    PurchaseInvoice,
    PurchaseInvoiceItem,
    PaymentVoucher,
    PaymentAllocation,

    // Sales
    SalesInvoice,
    SalesInvoiceItem,
    SaleItemBatchConsumption,
    ReceiptVoucher,
    ReceiptAllocation,

    // Sales Returns
    SalesReturn,
    SalesReturnItem,
    SalesReturnBatchAllocation,
    CustomerRefund,
  ],
});

// ─────────────────────────────────────────────────────────────
// Model Exports
// ─────────────────────────────────────────────────────────────

export {
  // Accounting
  AccountingPeriod,
  ChartOfAccount,
  AccountingSetting,
  JournalEntry,
  JournalEntryLine,

  // Parties
  Customer,
  Supplier,
  Expense,

  // Products & Inventory
  Category,
  Unit,
  Product,
  ProductUnit,
  ProductBatch,
  StockMovement,

  // Purchases
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PaymentVoucher,
  PaymentAllocation,

  // Sales
  SalesInvoice,
  SalesInvoiceItem,
  SaleItemBatchConsumption,
  ReceiptVoucher,
  ReceiptAllocation,

  // Sales Returns
  SalesReturn,
  SalesReturnItem,
  SalesReturnBatchAllocation,
  CustomerRefund,
};
