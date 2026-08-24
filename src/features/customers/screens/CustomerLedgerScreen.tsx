/* eslint-disable no-nested-ternary */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, useTheme, Surface, Card, Divider } from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { EmptyState } from "@shared/components/EmptyState";
import { DateRangePicker } from "@shared/components/DateRangePicker";
import { customerRepository, LedgerTransactionItem } from "../repositories/customerRepository";
import { formatDateTime } from "@shared/utils/date";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const CustomerLedgerScreen: React.FC<{
  navigation: NavigationProp;
  route: { params: { customerId: string } };
}> = ({ navigation, route }) => {
  const { customerId } = route.params;
  const theme = useTheme();
  const { t } = useTranslation("customers");

  const [customer, setCustomer] = useState<any>(null);
  const [transactions, setTransactions] = useState<LedgerTransactionItem[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // تحميل بيانات العميل والحركات
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const cust = await customerRepository.getById(customerId);
      const balance = await customerRepository.getOutstandingBalance(customerId);
      const ledger = await customerRepository.getDetailedLedger(customerId, startDate, endDate);

      setCustomer(cust);
      setOutstandingBalance(balance);
      setTransactions(ledger);
    } catch (error) {
      console.log("Error loading ledger:", error);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // رندر صف الحركة في الجدول
  const renderTransactionItem = ({ item }: { item: LedgerTransactionItem }) => {
    const isInvoice = item.type === "invoice";
    const label = isInvoice ? t("invoice") || "فاتورة مبيعات" : t("receipt") || "سند قبض";
    const variant = isInvoice ? "error" : "success";

    return (
      <View style={[styles.rowContainer, { borderBottomColor: theme.colors.surfaceVariant }]}>
        <View style={styles.rowHeader}>
          <StatusBadge label={label} variant={variant} compact />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatDateTime(item.date)}
          </Text>
        </View>

        <Text variant="bodyMedium" style={styles.descriptionText}>
          {item.description}
        </Text>

        <View style={styles.rowFinancials}>
          <View style={styles.colAmount}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("debit") || "مدين (عليه)"}
            </Text>
            <CurrencyText
              amount={item.debit}
              variant="bodyMedium"
              color={item.debit > 0 ? theme.colors.error : undefined}
            />
          </View>

          <View style={styles.colAmount}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("credit") || "دائن (له)"}
            </Text>
            <CurrencyText
              amount={item.credit}
              variant="bodyMedium"
              color={item.credit > 0 ? theme.colors.primary : undefined}
            />
          </View>

          <View style={styles.colAmount}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("runningBalance") || "الرصيد التراكمي"}
            </Text>
            <CurrencyText
              amount={item.runningBalance}
              variant="titleSmall"
              color={item.runningBalance > 0 ? theme.colors.error : item.runningBalance < 0 ? theme.colors.primary : undefined}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <AppHeader
        title={customer ? `${t("statementOfAccount") || "كشف حساب"}: ${customer.name}` : t("statementOfAccount") || "كشف حساب العملاء"}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scrollView}>
        {/* رأس الشاشة: بطاقة العميل والملخص المالي */}
        <Card style={[styles.headerCard, { backgroundColor: theme.colors.surface }]} mode="elevated">
          <Card.Content>
            <View style={styles.summaryContainer}>
              <View>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {customer?.name || "جار التحميل..."}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {customer?.phone || ""}
                </Text>
              </View>
              <View style={styles.balanceBox}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {outstandingBalance >= 0 ? t("netOutstanding") || "صافي المستحق (عليه)" : t("netAdvance") || "رصيد دائن (له)"}
                </Text>
                <CurrencyText
                  amount={Math.abs(outstandingBalance)}
                  variant="headlineSmall"
                  color={outstandingBalance > 0 ? theme.colors.error : outstandingBalance < 0 ? theme.colors.primary : undefined}
                />
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* شريط الفلاتر بالتاريخ باستخدام المكون المشترك DateRangePicker */}
        <Surface style={styles.filterSurface} elevation={1}>
          <Text variant="titleSmall" style={styles.filterTitle}>
            {t("filterByDate") || "تصفية حسب الفترة الزمنية"}
          </Text>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </Surface>

        {/* جدول حركات كشف الحساب */}
        <Surface style={styles.tableSurface} elevation={1}>
          <Text variant="titleMedium" style={styles.tableTitle}>
            {t("transactionsHistory") || "سجل الحركات والحسابات"} ({transactions.length})
          </Text>
          <Divider style={{ marginBottom: 8 }} />

          {transactions.length === 0 && !isLoading ? (
            <EmptyState
              icon="file-document-outline"
              title={t("noTransactions") || "لا توجد حركات مالية مسجلة"}
              subtitle={t("noTransactionsSubtitle") || "لم يتم العثور على فواتير أو سندات قبض خلال الفترة المحددة."}
            />
          ) : (
            <FlashList
              data={transactions}
              renderItem={renderTransactionItem}
              keyExtractor={(item) => item.id + item.date.toString()}
              estimatedItemSize={100}
              scrollEnabled={false}
            />
          )}
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, padding: 16 },
  headerCard: { marginBottom: 16, borderRadius: 12 },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceBox: { alignItems: "flex-end" },
  filterSurface: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  filterTitle: {
    marginBottom: 8,
    fontWeight: "bold",
  },
  tableSurface: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  tableTitle: {
    marginBottom: 12,
    fontWeight: "bold",
  },
  rowContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  descriptionText: {
    marginBottom: 8,
    fontWeight: "500",
  },
  rowFinancials: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.02)",
    padding: 8,
    borderRadius: 8,
  },
  colAmount: {
    alignItems: "center",
    flex: 1,
  },
});
