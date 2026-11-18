import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useTheme, FAB, SegmentedButtons, Text } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { AppHeader } from "@shared/components/AppHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";

import { usePurchaseInvoices } from "../hooks/usePurchaseInvoices";

import { paperIcon } from "@shared/components/Icon";
import { PurchaseInvoiceStatus } from "src/database/models/PurchaseInvoice";
import { PurchaseInvoiceCard } from "../components/PurchaseInvoiceCard";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

type FilterStatus = PurchaseInvoiceStatus | "all";

export const PurchaseInvoicesList: React.FC<{
  navigation: NavigationProp;
}> = ({ navigation }) => {
  const theme = useTheme();
  const { t } = useTranslation("purchases");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const status = statusFilter === "all" ? undefined : statusFilter;
  const { invoices, isLoading, error } = usePurchaseInvoices(status);

  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <AppHeader
          title={t("title")}
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Text style={{ color: theme.colors.error }}>{error.message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={t("title")}
        showBack
        onBack={() => navigation.goBack()}
        actions={[
          {
            icon: "plus",
            onPress: () => navigation.navigate("PurchaseInvoiceForm"),
          },
        ]}
      />

      <SegmentedButtons
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as FilterStatus)}
        buttons={[
          { value: "all", label: t("all") },
          { value: "draft", label: t("draft") },
          { value: "posted", label: t("posted") },
          { value: "cancelled", label: t("cancelled") },
        ]}
        style={styles.filterButtons}
      />

      {invoices.length === 0 ? (
        <EmptyState
          icon="file-document-outline"
          title={t("noInvoices")}
          subtitle={t("noInvoicesSubtitle")}
          actionLabel={t("addInvoice")}
          onAction={() => navigation.navigate("PurchaseInvoiceForm")}
        />
      ) : (
        <FlashList
          data={invoices}
          renderItem={({ item }) => (
            <PurchaseInvoiceCard
              invoiceNumber={item.invoiceNumber || t("draftLabel")}
              supplierId={item.supplierId}
              date={new Date(item.invoiceDate).toLocaleDateString()}
              total={item.total}
              status={item.status as PurchaseInvoiceStatus}
              onPress={() =>
                navigation.navigate("PurchaseInvoiceDetail", {
                  invoiceId: item.id,
                })
              }
            />
          )}
          keyExtractor={(item) => item.id}
          // estimatedItemSize={120}
          contentContainerStyle={styles.listContent}
        />
      )}

      <FAB
        icon={paperIcon("plus")}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate("PurchaseInvoiceForm")}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterButtons: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  listContent: {
    paddingBottom: 80,
    paddingTop: 4,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    borderRadius: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});

