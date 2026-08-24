// screens/MoreMenuScreen.tsx
import React from "react";
import { StyleSheet, ScrollView } from "react-native";
import { useTheme, List, Divider } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { paperIcon } from "@shared/components/Icon";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const MoreMenuScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => {
  const theme = useTheme();
  // 👈 تم إضافة namespaces متعددة لضمان جلب الترجمات الصحيحة
  const { t } = useTranslation(["common", "billing", "accounting"]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader title={t("common:more")} />
      <ScrollView>
        <List.Item
          title="إدارة الموردين"
          description="عرض الموردين وكشوفات الحسابات"
          left={(props) => (
            <List.Icon {...props} icon={paperIcon("truck-delivery")} />
          )}
          right={(props) => (
            <List.Icon {...props} icon={paperIcon("chevron-right")} />
          )}
          onPress={() => navigation.navigate("SupplierList")}
        />
        <Divider />

        <List.Item
          title="فاتورة مشتريات جديدة"
          description="تسجيل مشتريات جديدة وتغذية المخزون"
          left={(props) => (
            <List.Icon {...props} icon={paperIcon("cart-plus")} />
          )}
          right={(props) => (
            <List.Icon {...props} icon={paperIcon("chevron-right")} />
          )}
          onPress={() => navigation.navigate("PurchaseForm")}
        />
        <Divider />

        <List.Item
          title={t("common:reports")}
          description={t("common:viewReports")}
          left={(props) => (
            <List.Icon {...props} icon={paperIcon("chart-bar")} />
          )}
          right={(props) => (
            <List.Icon {...props} icon={paperIcon("chevron-right")} />
          )}
          onPress={() => navigation.navigate("Reports")}
        />
        <Divider />

        <List.Item
          title={t("billing:billHistory")}
          description={t("billing:viewBillHistory")}
          left={(props) => <List.Icon {...props} icon={paperIcon("receipt")} />}
          right={(props) => (
            <List.Icon {...props} icon={paperIcon("chevron-right")} />
          )}
          onPress={() =>
            navigation.navigate("BillingTab", { screen: "SalesInvoiceList" })
          }
        />
        <Divider />

        <List.Item
          title={t("accounting:chartOfAccounts")}
          description={t("accounting:chartOfAccountsDesc")}
          left={(props) => (
            <List.Icon {...props} icon={paperIcon("vector-arrange-after")} />
          )}
          right={(props) => (
            <List.Icon {...props} icon={paperIcon("chevron-right")} />
          )}
          onPress={() => navigation.navigate("ChartOfAccounts")}
        />
        <Divider />

        <List.Item
          title={t("accounting:accountingSettings")}
          description={t("accounting:accountingSettingsDesc")}
          left={(props) => (
            <List.Icon {...props} icon={paperIcon("calculator")} />
          )}
          right={(props) => (
            <List.Icon {...props} icon={paperIcon("chevron-right")} />
          )}
          onPress={() => navigation.navigate("AccountingSettings")}
        />
        <Divider />

        <List.Item
          title="إدارة التصنيفات"
          description="إضافة وتعديل وحذف تصنيفات المنتجات"
          left={(props) => (
            <List.Icon {...props} icon={paperIcon("folder-outline")} />
          )}
          right={(props) => (
            <List.Icon {...props} icon={paperIcon("chevron-right")} />
          )}
          onPress={() => navigation.navigate("CategoryManagement")}
        />
        <Divider />

        <List.Item
          title="إدارة وحدات القياس"
          description="إدارة وحدات البيع والشراء (قطعة، كرتون، إلخ)"
          left={(props) => (
            <List.Icon {...props} icon={paperIcon("scale-balance")} />
          )}
          right={(props) => (
            <List.Icon {...props} icon={paperIcon("chevron-right")} />
          )}
          onPress={() => navigation.navigate("UnitManagement")}
        />
        <Divider />

        <List.Item
          title="فحص وتأكيد النظام"
          description="التشخيص المحاسبي والبرمجي للبيانات"
          left={(props) => (
            <List.Icon {...props} icon={paperIcon("shield-check-outline")} />
          )}
          right={(props) => (
            <List.Icon {...props} icon={paperIcon("chevron-right")} />
          )}
          onPress={() => navigation.navigate("SystemDiagnostic")}
        />
        <Divider />

        <List.Item
          title={t("common:settings")}
          description={t("common:manageSettings")}
          left={(props) => <List.Icon {...props} icon={paperIcon("cog")} />}
          right={(props) => (
            <List.Icon {...props} icon={paperIcon("chevron-right")} />
          )}
          onPress={() => navigation.navigate("Settings")}
        />
        <Divider />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
