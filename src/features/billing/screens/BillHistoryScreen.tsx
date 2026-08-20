// screens/SalesInvoiceHistoryScreen.tsx
import React, { useState, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme, Text, Surface } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { SearchInput } from "@shared/components/SearchInput";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { AppIcon } from "@shared/components/Icon";
import SalesInvoice from "@core/database/models/SalesInvoice";
import { useDebounce } from "@shared/hooks/useDebounce";
import { formatCurrency } from "@shared/utils/currency";
import dayjs from "dayjs";
import { salesRepository } from "../repositories/salesRepository";
import { SalesInvoiceCard } from "../components/BillCard";

interface SalesInvoiceHistoryScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

export const SalesInvoiceHistoryScreen: React.FC<
  SalesInvoiceHistoryScreenProps
> = ({ navigation }) => {
  const theme = useTheme();
  const { t } = useTranslation("billing");
  const [searchQuery, setSearchQuery] = useState("");
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // ========== جلب الفواتير ==========
  useEffect(() => {
    const observable = debouncedSearch
      ? salesRepository.searchByInvoiceNumber(debouncedSearch)
      : salesRepository.observeAll();

    const subscription = observable.subscribe((result) => {
      setInvoices(result);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [debouncedSearch]);

  // ========== إحصائيات اليوم ==========
  const todayStats = useMemo(() => {
    const today = dayjs().startOf("day");
    const todayInvoices = invoices.filter((invoice) =>
      dayjs(invoice.invoiceDate).isAfter(today),
    );
    const todayTotal = todayInvoices.reduce(
      (sum, invoice) => sum + invoice.total,
      0,
    );
    return { count: todayInvoices.length, total: todayTotal };
  }, [invoices]);

  // ========== حالة التحميل ==========
  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={t("invoiceHistory")}
        showBack
        onBack={() => navigation.goBack()}
      />

      {/* ===== إحصائيات اليوم ===== */}
      <Surface
        style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}
        elevation={1}
      >
        <View style={styles.summaryItem}>
          <AppIcon name="receipt" size={20} color={theme.colors.primary} />
          <View>
            <Text
              variant="titleLarge"
              style={[styles.summaryValue, { color: theme.colors.onSurface }]}
            >
              {todayStats.count}
            </Text>
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("todayInvoices")}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.summaryDivider,
            { backgroundColor: theme.colors.outlineVariant },
          ]}
        />

        <View style={styles.summaryItem}>
          <AppIcon name="cash" size={20} color={theme.colors.primary} />
          <View>
            <Text
              variant="titleLarge"
              style={[styles.summaryValue, { color: theme.colors.primary }]}
            >
              {formatCurrency(todayStats.total)}
            </Text>
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("todaySales")}
            </Text>
          </View>
        </View>
      </Surface>

      {/* ===== شريط البحث ===== */}
      <SearchInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t("searchInvoices")}
      />

      {/* ===== قائمة الفواتير ===== */}
      {invoices.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={t("noInvoices")}
          subtitle={t("noInvoicesSubtitle")}
        />
      ) : (
        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {invoices.length} {t("invoicesFound")}
            </Text>
          </View>

          <FlashList
            data={invoices}
            renderItem={({ item }: { item: SalesInvoice }) => (
              <SalesInvoiceCard
                invoiceNumber={item.id || `#${item.id.slice(0, 8)}`}
                total={item.total}
                paymentType={item.paymentType}
                status={item.status}
                invoiceDate={item.invoiceDate}
                customerName={item.customer?.name}
                onPress={() =>
                  navigation.navigate("SalesInvoiceDetail", {
                    invoiceId: item.id,
                  })
                }
              />
            )}
            keyExtractor={(item: SalesInvoice) => item.id}
            // estimatedItemSize={90}
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryValue: {
    fontWeight: "700",
  },
  summaryDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 12,
  },
  listContainer: {
    flex: 1,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  listContent: {
    paddingBottom: 16,
  },
});
