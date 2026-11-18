import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MoreStackParamList } from "./types";
import { MoreMenuScreen } from "./screens/MoreMenuScreen";
import { ReportsScreen } from "src/application/features/reports/screens/ReportsScreen";
import { SalesReportScreen } from "src/application/features/reports/screens/SalesReportScreen";
import { CreditReportScreen } from "src/application/features/reports/screens/CreditReportScreen";
import { InventoryReportScreen } from "src/application/features/reports/screens/InventoryReportScreen";
import { ProductPerformanceScreen } from "src/application/features/reports/screens/ProductPerformanceScreen";
import { SettingsScreen } from "src/application/features/settings/screens/SettingsScreen";
import { ChartOfAccountsScreen } from "src/application/features/accounting/screens/ChartOfAccountsScreen";
import { AccountingSettingsScreen } from "src/application/features/accounting/screens/AccountingSettingsScreen";
import { SystemDiagnosticScreen } from "src/application/features/settings/screens/SystemDiagnosticScreen";
import { CategoryManagementScreen } from "src/application/features/inventory/screens/CategoryManagementScreen";
import { UnitManagementScreen } from "src/application/features/inventory/screens/UnitManagementScreen";
import {
  AccountStatementScreen,
  GeneralLedgerScreen,
  JournalEntriesScreen,
  JournalEntryDetailsScreen,
  TrialBalanceScreen,
} from "src/application/features/accounting/screens/JournalEntriesScreens";
import {
  CreatePaymentScreen,
  CreateReceiptScreen,
  PaymentDetailsScreen,
  PaymentListScreen,
  ReceiptDetailsScreen,
  ReceiptListScreen,
} from "src/application/features/vouchers/screens/VoucherScreens";
import { SupplierListScreen } from "src/application/features/suppliers/screens/SupplierListScreen";
import { SupplierLedgerScreen } from "src/application/features/suppliers/screens/SupplierLedgerScreen";
import { PurchaseInvoicesList } from "src/application/features/purchase/screens/PurchaseInvoicesList";
import { PurchaseInvoiceForm } from "src/application/features/purchase/screens/PurchaseInvoiceForm";
import { PurchaseInvoiceDetail } from "src/application/features/purchase/screens/PurchaseInvoiceDetail";
import { PurchaseInvoiceEdit } from "src/application/features/purchase/screens/PurchaseInvoiceEdit";

const Stack = createNativeStackNavigator<MoreStackParamList>();

export const MoreStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MoreMenu" component={MoreMenuScreen} />
    <Stack.Screen name="Reports" component={ReportsScreen} />
    <Stack.Screen name="SalesReport" component={SalesReportScreen} />
    <Stack.Screen name="CreditReport" component={CreditReportScreen} />
    <Stack.Screen name="InventoryReport" component={InventoryReportScreen} />
    <Stack.Screen
      name="ProductPerformance"
      component={ProductPerformanceScreen}
    />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="ChartOfAccounts" component={ChartOfAccountsScreen} />
    <Stack.Screen name="JournalEntries" component={JournalEntriesScreen} />
    <Stack.Screen
      name="JournalEntryDetails"
      component={JournalEntryDetailsScreen}
    />
    <Stack.Screen name="GeneralLedger" component={GeneralLedgerScreen} />
    <Stack.Screen name="TrialBalance" component={TrialBalanceScreen} />
    <Stack.Screen name="AccountStatement" component={AccountStatementScreen} />
    <Stack.Screen name="ReceiptList" component={ReceiptListScreen} />
    <Stack.Screen name="CreateReceipt" component={CreateReceiptScreen} />
    <Stack.Screen name="ReceiptDetails" component={ReceiptDetailsScreen} />
    <Stack.Screen name="PaymentList" component={PaymentListScreen} />
    <Stack.Screen name="CreatePayment" component={CreatePaymentScreen} />
    <Stack.Screen name="PaymentDetails" component={PaymentDetailsScreen} />
    <Stack.Screen
      name="AccountingSettings"
      component={AccountingSettingsScreen}
    />
    <Stack.Screen name="SystemDiagnostic" component={SystemDiagnosticScreen} />
    <Stack.Screen
      name="CategoryManagement"
      component={CategoryManagementScreen}
    />
    <Stack.Screen name="UnitManagement" component={UnitManagementScreen} />
    {/* Ø´Ø§Ø´Ø§Øª Ø§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ† ÙˆØ§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª Ø¯Ø§Ø®Ù„ Ù…ÙƒØ¯Ø³ Ø§Ù„Ù…Ø²ÙŠØ¯ */}
    <Stack.Screen name="SupplierList" component={SupplierListScreen} />
    <Stack.Screen name="SupplierLedger" component={SupplierLedgerScreen} />
    <Stack.Screen name="PurchaseInvoiceForm" component={PurchaseInvoiceForm} />
    <Stack.Screen
      name="PurchaseInvoicesList"
      component={PurchaseInvoicesList}
    />
    <Stack.Screen
      name="PurchaseInvoiceDetail"
      component={PurchaseInvoiceDetail}
    />
    <Stack.Screen name="PurchaseInvoiceEdit" component={PurchaseInvoiceEdit} />
  </Stack.Navigator>
);
