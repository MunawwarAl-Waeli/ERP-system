// screens/SalesInvoiceDetailScreen.tsx
import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { Text, useTheme, Button, Divider, Surface } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import SalesInvoice from "@core/database/models/SalesInvoice";
import SalesInvoiceItem from "@core/database/models/SalesInvoiceItem";
import Customer from "@core/database/models/Customer";

import {
  salesInvoicePdfService,
  SalesInvoicePdfData,
} from "../services/salesInvoicePdfService";
import { useSettingsStore } from "@features/settings/store/useSettingsStore";
import { formatDateTime } from "@shared/utils/date";
import { CURRENCY_SYMBOL } from "@core/constants";
import { salesRepository } from "../repositories/salesRepository";

type _SalesInvoiceStatus =
  | "draft"
  | "approved"
  | "cancelled"
  | "paid"
  | "partial";
type _PaymentType = "cash" | "credit" | "partial";

interface SalesInvoiceDetailScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
  route: { params: { invoiceId: string } };
}

interface ItemWithProductName {
  item: SalesInvoiceItem;
  productName: string;
}

export const SalesInvoiceDetailScreen: React.FC<
  SalesInvoiceDetailScreenProps
> = ({ navigation, route }) => {
  const { invoiceId } = route.params;
  const theme = useTheme();
  const { t } = useTranslation("billing");
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [itemsWithNames, setItemsWithNames] = useState<ItemWithProductName[]>(
    [],
  );
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const storeProfile = useSettingsStore((state) => state.storeProfile);

  // ========== جلب البيانات ==========
  useEffect(() => {
    const invoiceSub = salesRepository
      .observeById(invoiceId)
      .subscribe(async (inv) => {
        setInvoice(inv);
        setIsLoading(false);

        // جلب بيانات العميل
        if (inv?.customerId) {
          try {
            const cust = await inv.customer.fetch();
            setCustomer(cust);
          } catch {
            setCustomer(null);
          }
        }
      });

    const itemsSub = salesRepository
      .observeItems(invoiceId)
      .subscribe(async (itemsList) => {
        // جلب أسماء المنتجات بشكل آمن لكل بند في WatermelonDB
        const resolvedItems = await Promise.all(
          itemsList.map(async (item) => {
            let productName = t("unknownProduct");
            try {
              if (item.productId) {
                const prod = await item.product.fetch();
                if (prod?.name) {
                  productName = prod.name;
                }
              } else if (item.description) {
                productName = item.description;
              }
            } catch {
              // Fallback
            }
            return { item, productName };
          }),
        );
        setItemsWithNames(resolvedItems);
      });

    return () => {
      invoiceSub.unsubscribe();
      itemsSub.unsubscribe();
    };
  }, [invoiceId, t]);

  // ========== تجهيز بيانات PDF ==========
  const preparePdfData = (): SalesInvoicePdfData | null => {
    if (!invoice) {
      return null;
    }

    return {
      storeName: storeProfile.name,
      storeAddress: storeProfile.address,
      storePhone: storeProfile.phone,
      gstNumber: storeProfile.gstNumber,
      invoiceNumber: invoice.invoiceNumber || `#${invoice.id.slice(0, 8)}`,
      invoiceDate: invoice.invoiceDate,
      items: itemsWithNames.map(({ item, productName }) => ({
        productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      subtotal: invoice.total,
      discountTotal: 0,
      grandTotal: invoice.total,
      paymentType: invoice.paymentType,
      customerName: customer?.name,
      customerPhone: customer?.phone,
      status: invoice.status,
    };
  };

  // ========== مشاركة PDF ==========
  const handleSharePdf = async () => {
    const pdfData = preparePdfData();
    if (!pdfData) {
      return;
    }

    setIsGeneratingPdf(true);
    try {
      await salesInvoicePdfService.sharePdf(pdfData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("common:error");
      Alert.alert(t("common:error"), errorMessage);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ========== حالة التحميل ==========
  if (isLoading || !invoice) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <LoadingOverlay visible />
      </SafeAreaView>
    );
  }

  // ========== الحالة ==========
  const getStatusVariant = (): "success" | "error" | "info" | "warning" => {
    switch (invoice.status) {
      case "approved":
      case "paid":
        return "success";
      case "cancelled":
        return "error";
      case "draft":
        return "warning";
      case "partial":
        return "info";
      default:
        return "info";
    }
  };

  const getStatusLabel = (): string => {
    switch (invoice.status) {
      case "draft":
        return t("draft");
      case "approved":
        return t("approved");
      case "cancelled":
        return t("cancelled");
      case "paid":
        return t("paid");
      case "partial":
        return t("partial");
      default:
        return invoice.status;
    }
  };

  // ========== طريقة الدفع ==========
  const getPaymentIcon = (): string => {
    switch (invoice.paymentType) {
      case "cash":
        return "cash";
      case "credit":
        return "account-clock";
      case "partial":
        return "percent";
      default:
        return "cash";
    }
  };

  const getPaymentColor = (): string => {
    switch (invoice.paymentType) {
      case "cash":
        return theme.colors.primary;
      case "credit":
        return theme.colors.error;
      case "partial":
        return theme.colors.tertiary;
      default:
        return theme.colors.primary;
    }
  };

  const getPaymentLabel = (): string => {
    switch (invoice.paymentType) {
      case "cash":
        return t("cash");
      case "credit":
        return t("credit");
      case "partial":
        return t("partial");
      default:
        return invoice.paymentType;
    }
  };

  const isCancelled = invoice.status === "cancelled";

  // ========== عرض الإجمالي ==========
  const totalAmount = itemsWithNames.reduce(
    (sum, { item }) => sum + item.total,
    0,
  );

  // ========== التصميم ==========
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={`${t("invoiceNumber")} #${
          invoice.invoiceNumber || invoice.id.slice(0, 8)
        }`}
        showBack
        onBack={() => navigation.goBack()}
        actions={[
          {
            icon: "share-variant",
            onPress: handleSharePdf,
          },
        ]}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== البطاقة العلوية (Hero) ===== */}
        <Surface
          style={[
            styles.heroCard,
            {
              backgroundColor: isCancelled
                ? theme.colors.errorContainer
                : theme.colors.primaryContainer,
            },
          ]}
          elevation={0}
        >
          <StatusBadge label={getStatusLabel()} variant={getStatusVariant()} />
          <CurrencyText
            amount={invoice.total}
            variant="displaySmall"
            color={
              isCancelled
                ? theme.colors.onErrorContainer
                : theme.colors.onPrimaryContainer
            }
            style={isCancelled ? styles.cancelledAmount : undefined}
          />
          <Text
            variant="bodyMedium"
            style={{
              color: isCancelled
                ? theme.colors.onErrorContainer
                : theme.colors.onPrimaryContainer,
              opacity: 0.8,
            }}
          >
            #{invoice.invoiceNumber || invoice.id.slice(0, 8)}
          </Text>
        </Surface>

        {/* ===== صف المعلومات الإضافية ===== */}
        <View style={styles.metaRow}>
          <View
            style={[
              styles.metaChip,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <AppIcon
              name="history"
              size={14}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {formatDateTime(new Date(invoice.invoiceDate).getTime())}
            </Text>
          </View>
          <View
            style={[
              styles.metaChip,
              { backgroundColor: `${getPaymentColor()}18` },
            ]}
          >
            <AppIcon
              name={getPaymentIcon()}
              size={14}
              color={getPaymentColor()}
            />
            <Text
              variant="labelMedium"
              style={{ color: getPaymentColor(), fontWeight: "600" }}
            >
              {getPaymentLabel()}
            </Text>
          </View>
        </View>

        {/* ===== بطاقة العميل ===== */}
        {customer && (
          <Surface
            style={[
              styles.customerCard,
              { backgroundColor: theme.colors.surface },
            ]}
            elevation={1}
          >
            <View style={styles.customerRow}>
              <View
                style={[
                  styles.customerAvatar,
                  { backgroundColor: theme.colors.secondaryContainer },
                ]}
              >
                <AppIcon
                  name="user"
                  size={18}
                  color={theme.colors.onSecondaryContainer}
                />
              </View>
              <View style={styles.customerInfo}>
                <Text
                  variant="titleSmall"
                  style={{ color: theme.colors.onSurface }}
                >
                  {customer.name}
                </Text>
                {customer.phone ? (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {customer.phone}
                  </Text>
                ) : null}
              </View>
            </View>
          </Surface>
        )}

        {/* ===== بطاقة البنود ===== */}
        <Surface
          style={[styles.itemsCard, { backgroundColor: theme.colors.surface }]}
          elevation={1}
        >
          {/* رأس الجدول */}
          <View
            style={[
              styles.tableHeader,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Text
              variant="labelSmall"
              style={[
                styles.colHash,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              #
            </Text>
            <Text
              variant="labelSmall"
              style={[
                styles.colItem,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {t("itemsSection").toUpperCase()}
            </Text>
            <Text
              variant="labelSmall"
              style={[
                styles.colQty,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {t("quantity").toUpperCase()}
            </Text>
            <Text
              variant="labelSmall"
              style={[
                styles.colRate,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {t("price").toUpperCase()}
            </Text>
            <Text
              variant="labelSmall"
              style={[
                styles.colAmount,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {t("total").toUpperCase()}
            </Text>
          </View>

          {/* صفوف البنود */}
          {itemsWithNames.map(({ item, productName }, index) => (
            <View key={item.id}>
              {index > 0 && <Divider style={styles.itemDivider} />}
              <View style={styles.tableRow}>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.colHash,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {index + 1}
                </Text>
                <View style={styles.colItem}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurface }}
                    numberOfLines={2}
                  >
                    {productName}
                  </Text>
                </View>
                <Text
                  variant="bodyMedium"
                  style={[styles.colQty, { color: theme.colors.onSurface }]}
                >
                  {item.quantity}
                </Text>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.colRate,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {CURRENCY_SYMBOL}
                  {item.unitPrice.toFixed(0)}
                </Text>
                <Text
                  variant="titleSmall"
                  style={[styles.colAmount, { color: theme.colors.onSurface }]}
                >
                  {CURRENCY_SYMBOL}
                  {item.total.toFixed(2)}
                </Text>
              </View>
            </View>
          ))}

          {/* الملخص داخل بطاقة البنود */}
          <View
            style={[
              styles.summarySection,
              { borderTopColor: theme.colors.outlineVariant },
            ]}
          >
            <View style={styles.summaryRow}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("subtotal")} ({itemsWithNames.length}{" "}
                {itemsWithNames.length === 1 ? "item" : "items"})
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {CURRENCY_SYMBOL}
                {totalAmount.toFixed(2)}
              </Text>
            </View>

            <Divider style={styles.totalDivider} />

            <View style={styles.grandTotalRow}>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurface, fontWeight: "700" }}
              >
                {t("grandTotal")}
              </Text>
              <CurrencyText
                amount={invoice.total}
                variant="titleLarge"
                color={
                  isCancelled
                    ? theme.colors.onSurfaceVariant
                    : theme.colors.primary
                }
                style={styles.grandTotalValue}
              />
            </View>
          </View>
        </Surface>

        <View style={styles.scrollPadding} />
      </ScrollView>

      {/* ===== الأزرار السفلية ===== */}
      <Surface
        style={[
          styles.bottomActions,
          { backgroundColor: theme.colors.surface },
        ]}
        elevation={2}
      >
        <Button
          mode="outlined"
          onPress={handleSharePdf}
          icon={paperIcon("file-text")}
          style={styles.shareButton}
          contentStyle={styles.buttonContent}
          loading={isGeneratingPdf}
          disabled={isGeneratingPdf}
        >
          {t("sharePdf")}
        </Button>
        <Button
          mode="contained"
          onPress={() => navigation.navigate("BillingHome")}
          icon={paperIcon("plus")}
          style={styles.newBillButton}
          contentStyle={styles.buttonContent}
        >
          {t("newBill")}
        </Button>
      </Surface>

      <LoadingOverlay visible={isGeneratingPdf} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollPadding: {
    height: 8,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  cancelledAmount: {
    textDecorationLine: "line-through",
  },
  metaRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  customerCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  customerInfo: {
    flex: 1,
    gap: 2,
  },
  itemsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  colHash: {
    width: 24,
    textAlign: "center",
  },
  colItem: {
    flex: 1,
    paddingHorizontal: 6,
  },
  colQty: {
    width: 36,
    textAlign: "center",
  },
  colRate: {
    width: 56,
    textAlign: "right",
  },
  colAmount: {
    width: 72,
    textAlign: "right",
    fontWeight: "600",
  },
  itemDivider: {
    marginHorizontal: 14,
    opacity: 0.5,
  },
  summarySection: {
    borderTopWidth: 1,
    marginHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  totalDivider: {
    marginVertical: 10,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
  },
  grandTotalValue: {
    fontWeight: "700",
  },
  bottomActions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  shareButton: {
    flex: 1,
    borderRadius: 10,
  },
  newBillButton: {
    flex: 1,
    borderRadius: 10,
  },
  buttonContent: {
    paddingVertical: 4,
  },
});
