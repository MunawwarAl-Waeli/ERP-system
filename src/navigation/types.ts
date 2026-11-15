import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from "@react-navigation/native";

// ── Dashboard Stack ──
export type DashboardStackParamList = {
  DashboardHome: undefined;
};

// ── Customer Stack ──
export type CustomerStackParamList = {
  CustomerList: { selectionMode?: boolean } | undefined;
  CustomerDetail: { customerId: string };
  CustomerForm: { customerId?: string } | undefined;
  CustomerLedger: { customerId: string };
};

// ── Supplier Stack ──
export type SupplierStackParamList = {
  SupplierList: undefined;
  SupplierDetail: { supplierId: string };
  SupplierForm: { supplierId?: string } | undefined;
  SupplierLedger: { supplierId: string };
};

// ── Purchase Stack ──
export type PurchaseStackParamList = {
  PurchaseInvoicesList: undefined;
  PurchaseInvoiceForm: { invoiceId?: string } | undefined;
  PurchaseInvoiceDetail: { invoiceId: string };
  PurchaseInvoiceEdit: { invoiceId: string };
  PurchaseForm: { purchaseId?: string } | undefined;
};

// ── Inventory Stack ──
export type InventoryStackParamList = {
  ProductList: undefined;
  ProductDetail: { productId: string };
  ProductForm: { productId?: string } | undefined;
  StockAdjustment: { productId: string };
  InventoryOverview: undefined;
};

// ── Billing Stack ──
export type BillingStackParamList = {
  BillingHome: undefined;
  SalesInvoiceDetail: { invoiceId: string };
  SalesInvoiceList: undefined;
};

// ── More (Reports + Settings) Stack ──
export type MoreStackParamList = {
  MoreMenu: undefined;
  Reports: undefined;
  SalesReport: undefined;
  CreditReport: undefined;
  InventoryReport: undefined;
  ProductPerformance: undefined;
  Settings: undefined;
  ChartOfAccounts: undefined;
  JournalEntries: undefined;
  JournalEntryDetails: { entryId: string };
  GeneralLedger: { accountId?: string } | undefined;
  TrialBalance: undefined;
  AccountStatement: { accountId?: string } | undefined;
  ReceiptList: undefined;
  CreateReceipt: undefined;
  ReceiptDetails: { voucherId: string };
  PaymentList: undefined;
  CreatePayment: undefined;
  PaymentDetails: { voucherId: string };
  AccountingSettings: undefined;
  ExpenseList: undefined;
  SystemDiagnostic: undefined;
  CategoryManagement: undefined;
  UnitManagement: undefined;
  SupplierList: undefined;
  SupplierDetail: { supplierId: string };
  SupplierForm: { supplierId?: string } | undefined;
  SupplierLedger: { supplierId: string };
  PurchaseForm: { purchaseId?: string } | undefined;
  PurchaseInvoicesList: undefined;
  PurchaseInvoiceForm: { invoiceId?: string } | undefined;
  PurchaseInvoiceDetail: { invoiceId: string };
  PurchaseInvoiceEdit: { invoiceId: string };
};

// ── Main Tab Navigator ──
export type MainTabParamList = {
  DashboardTab: NavigatorScreenParams<DashboardStackParamList>;
  CustomersTab: NavigatorScreenParams<CustomerStackParamList>;
  BillingTab: NavigatorScreenParams<BillingStackParamList>;
  InventoryTab: NavigatorScreenParams<InventoryStackParamList>;
  SupplierTab: NavigatorScreenParams<SupplierStackParamList>;
  PurchaseTab: NavigatorScreenParams<PurchaseStackParamList>;
  MoreTab: NavigatorScreenParams<MoreStackParamList>;
};

// ── Root Navigator ──
export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
};

// ── Screen Props helpers ──
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type DashboardScreenProps<T extends keyof DashboardStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<DashboardStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type CustomerScreenProps<T extends keyof CustomerStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<CustomerStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type InventoryScreenProps<T extends keyof InventoryStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<InventoryStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type PurchaseScreenProps<T extends keyof PurchaseStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<PurchaseStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type BillingScreenProps<T extends keyof BillingStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<BillingStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type MoreScreenProps<T extends keyof MoreStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<MoreStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;
