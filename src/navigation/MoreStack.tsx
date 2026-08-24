import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MoreStackParamList } from "./types";
import { MoreMenuScreen } from "./screens/MoreMenuScreen";
import { ReportsScreen } from "@features/reports/screens/ReportsScreen";
import { SalesReportScreen } from "@features/reports/screens/SalesReportScreen";
import { CreditReportScreen } from "@features/reports/screens/CreditReportScreen";
import { InventoryReportScreen } from "@features/reports/screens/InventoryReportScreen";
import { ProductPerformanceScreen } from "@features/reports/screens/ProductPerformanceScreen";
import { SettingsScreen } from "@features/settings/screens/SettingsScreen";
import { ChartOfAccountsScreen } from "@features/accounting/screens/ChartOfAccountsScreen";
import { AccountingSettingsScreen } from "@features/accounting/screens/AccountingSettingsScreen";
import { SystemDiagnosticScreen } from "@features/settings/screens/SystemDiagnosticScreen";
import { CategoryManagementScreen } from "@features/products/screens/CategoryManagementScreen";
import { UnitManagementScreen } from "@features/products/screens/UnitManagementScreen";
import { SupplierListScreen } from "@features/suppliers/screens/SupplierListScreen";
import { SupplierLedgerScreen } from "@features/suppliers/screens/SupplierLedgerScreen";
import { PurchaseFormScreen } from "@features/purchase/screens/PurchaseFormScreen";


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
    {/* شاشات الموردين والمشتريات داخل مكدس المزيد */}
    <Stack.Screen name="SupplierList" component={SupplierListScreen} />
    <Stack.Screen name="SupplierLedger" component={SupplierLedgerScreen} />
    <Stack.Screen name="PurchaseForm" component={PurchaseFormScreen} />
  </Stack.Navigator>
);
