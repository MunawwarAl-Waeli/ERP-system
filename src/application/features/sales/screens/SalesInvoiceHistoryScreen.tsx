// screens/SalesInvoiceHistoryScreen.tsx
import React, { useState } from "react";
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
import { CurrencyText } from "@shared/components/CurrencyText";
import { useDebounce } from "@shared/hooks/useDebounce";
import { SalesInvoiceCard } from "../components/BillCard";
import {
  useSalesInvoiceHistory,
  SalesInvoiceHistoryItem,
} from "../hooks/useSalesInvoiceHistory";

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
  const debouncedSearch = useDebounce(searchQuery, 300);

  // ✅ البيانات من hook مركزي (يعتمد على services + salesRepository)
  const { items, isLoading, todayCount, todayTotal } =
    useSalesInvoiceHistory(debouncedSearch);

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
              {todayCount}
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
            <CurrencyText
              amount={todayTotal}
              variant="titleLarge"
              color={theme.colors.primary}
            />
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
      {items.length === 0 ? (
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
              {items.length} {t("invoicesFound")}
            </Text>
          </View>

          <FlashList
            data={items}
            renderItem={({ item }: { item: SalesInvoiceHistoryItem }) => {
              const inv = item.invoice;
              return (
                <SalesInvoiceCard
                  invoiceNumber={inv.invoiceNumber || `#${inv.id.slice(0, 8)}`}
                  total={inv.total}
                  paymentType={inv.paymentType}
                  status={inv.status}
                  invoiceDate={inv.invoiceDate}
                  customerName={item.customerName || t("walkInCustomer")}
                  onPress={() =>
                    navigation.navigate("SalesInvoiceDetail", {
                      invoiceId: inv.id,
                    })
                  }
                />
              );
            }}
            keyExtractor={(item: SalesInvoiceHistoryItem) => item.invoice.id}
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
