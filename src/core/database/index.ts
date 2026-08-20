import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { Platform } from "react-native";

import { schema } from "./schema";
import { migrations } from "./migrations";

import Customer from "./models/Customer";
import Category from "./models/Category";
import Product from "./models/Product";
import AccountingPeriod from "./models/AccountingPeriod";
import ChartOfAccount from "./models/ChartOfAccount";
import StockMovement from "./models/StockMovement"; // 👈 Import the missing model
import PaymentAllocation from "./models/PaymentAllocation";
import PurchaseInvoice from "./models/PurchaseInvoice";
import PurchaseInvoiceItem from "./models/PurchaseInvoiceItem";
import ProductUnit from "./models/ProductUnit";
import Supplier from "./models/Supplier";
import Unit from "./models/Unit";
import JournalEntry from "./models/JournalEntry";
import JournalEntryLine from "./models/JournalEntryLine";
import AccountingSetting from "./models/AccountingSetting";
import SalesInvoice from "./models/SalesInvoice";
import SalesInvoiceItem from "./models/SalesInvoiceItem";
import ProductBatch from "./models/ProductBatch";
import ReceiptVoucher from "./models/ReceiptVoucher";
import PaymentVoucher from "./models/PaymentVoucher";
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: Platform.OS === "ios",
  onSetUpError: (error) => {
    console.error("Database setup error:", error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    Customer,
    Category,
    Product,
    AccountingPeriod,
    ProductBatch,
    StockMovement, // 👈 Register the model
    PaymentVoucher,
    ReceiptVoucher,
    ChartOfAccount,
    PaymentAllocation,
    PurchaseInvoice,
    PurchaseInvoiceItem,
    ProductUnit,
    Supplier,
    Unit,
    JournalEntry,
    JournalEntryLine,
    AccountingSetting,
    SalesInvoice,
    SalesInvoiceItem,
  ],
});

export {
  Customer,
  Category,
  Product,
  AccountingPeriod,
  ProductBatch,
  StockMovement,
  PaymentVoucher,
  ReceiptVoucher,
  ChartOfAccount,
  PaymentAllocation,
  PurchaseInvoice,
  PurchaseInvoiceItem,
  ProductUnit,
  Supplier,
  Unit,
  JournalEntry,
  JournalEntryLine,
  AccountingSetting,
  SalesInvoice,
  SalesInvoiceItem,
};
