// screens/SalesInvoiceDetailScreen.tsx
import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, useTheme, Button, Divider, Surface } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { notify } from "@shared/notifications";

import {
  CURRENCY_SYMBOL,
  DOCUMENT_STATUSES,
  PAYMENT_TYPES,
} from "@core/constants";

import {
  salesInvoicePdfService,
  SalesInvoicePdfData,
} from "../services/salesInvoicePdfService";
import { useSettingsStore } from "src/application/features/settings/store/useSettingsStore";
import { formatDateTime } from "@shared/utils/date";
// import { salesRepository } from "../repositories/salesRepository";
import { useSalesInvoiceDetail } from "../hooks/useSalesInvoiceDetail";
import { repositories, services } from "src/application/compositionRoot";

interface SalesInvoiceDetailScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
  route: { params: { invoiceId: string } };
}

// الحالات الموروثة (aliases لـPOSTED)
const LEGACY_POSTED_ALIASES = ["approved", "paid"];

const isLegacyPosted = (status: string): boolean =>
  LEGACY_POSTED_ALIASES.includes(status);

const isPostedStatus = (status: string): boolean =>
  status === DOCUMENT_STATUSES.POSTED || isLegacyPosted(status);

export const SalesInvoiceDetailScreen: React.FC<
  SalesInvoiceDetailScreenProps
> = ({ navigation, route }) => {
  const { invoiceId } = route.params;
  const theme = useTheme();
  const { t } = useTranslation("billing");
  // ✅ الحصول على البيانات من hook مركزي (يعتمد على services)
  const { invoice, itemsWithNames, customer, isLoading } =
    useSalesInvoiceDetail(invoiceId);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const storeProfile = useSettingsStore((state) => state.storeProfile);

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
      notify.error(error instanceof Error ? error.message : t("common:error"));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ========== الترحيل (عبر الخدمة) ==========
  const handlePost = async () => {
    if (!invoice || isPosting) return;

    // التحقق من المبلغ المدفوع للفاتورة الجزئية
    if (invoice.paymentType === PAYMENT_TYPES.PARTIAL) {
      if (!invoice.paidAmount || invoice.paidAmount <= 0) {
        notify.warning(
          t("partialAmountRequired") ||
            "الفاتورة الجزئية تتطلب إدخال المبلغ المدفوع",
        );
        return;
      }
      if (invoice.paidAmount >= invoice.total) {
        notify.warning(
          t("partialExceedsTotal") ||
            "المبلغ المدفوع يجب أن يكون أقل من الإجمالي",
        );
        return;
      }
    }

    // قراءة حساب الدفع من الإعدادات (للنقدي والجزئي)
    let paymentAccountId: string | undefined;
    if (
      invoice.paymentType === PAYMENT_TYPES.CASH ||
      invoice.paymentType === PAYMENT_TYPES.PARTIAL
    ) {
      try {
        const settings = await repositories.accountingSetting.get();
        paymentAccountId = settings?.cashDefaultAccountId || undefined;
        if (!paymentAccountId) {
          notify.error(
            "لم يتم ضبط حساب الصندوق الافتراضي في الإعدادات المحاسبية",
          );
          return;
        }
      } catch {
        notify.error("فشل قراءة الإعدادات المحاسبية");
        return;
      }
    }

    setIsPosting(true);
    try {
      // ✅ إجبار المبلغ المدفوع ليكون مطابقاً للإجمالي في حالة النقدي لتجنب أي مشاكل
      let finalPaidAmount = 0;
      if (invoice.paymentType === PAYMENT_TYPES.CASH) {
        finalPaidAmount = invoice.total;
      } else if (invoice.paymentType === PAYMENT_TYPES.PARTIAL) {
        finalPaidAmount = invoice.paidAmount || 0;
      }

      await services.salesInvoice.post({
        salesInvoiceId: invoice.id,
        paidAmount: Math.round(finalPaidAmount),
        paymentAccountId,
      });
      notify.success(
        t("invoicePosted") ||
          "تم ترحيل الفاتورة بنجاح وتوليد القيود وتحديث المخزون.",
      );
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : t("common:operationFailed"),
      );
    } finally {
      setIsPosting(false);
    }
  };

  // ========== الإلغاء (عبر الخدمة) ==========
  const handleCancelPress = () => {
    if (!invoice || isCancelling) return;
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = async () => {
    if (!invoice || isCancelling) return;
    setShowCancelDialog(false);
    setIsCancelling(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await services.salesInvoice.cancel(invoice.id, today);
      notify.success(
        t("invoiceCancelled") ||
          "تم إلغاء الفاتورة وعكس القيود والمخزون بنجاح.",
      );
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : t("common:operationFailed"),
      );
    } finally {
      setIsCancelling(false);
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

  // ========== الحالة (Variant) ==========
  const getStatusVariant = (): "success" | "error" | "info" | "warning" => {
    const status = invoice.status;
    if (status === DOCUMENT_STATUSES.DRAFT) return "warning";
    if (status === DOCUMENT_STATUSES.CANCELLED) return "error";
    if (isPostedStatus(status)) return "success";
    return "info";
  };

  // ========== الحالة (Label) ==========
  const getStatusLabel = (): string => {
    const status = invoice.status;
    if (status === DOCUMENT_STATUSES.DRAFT) return t("draft");
    if (status === DOCUMENT_STATUSES.CANCELLED) return t("cancelled");
    if (isPostedStatus(status)) return t("posted") || "مرحل";
    return status;
  };

  // ========== طريقة الدفع (Icon) ==========
  const getPaymentIcon = (): string => {
    switch (invoice.paymentType) {
      case PAYMENT_TYPES.CASH:
        return "cash";
      case PAYMENT_TYPES.CREDIT:
        return "account-clock";
      case PAYMENT_TYPES.PARTIAL:
        return "percent";
      default:
        return "cash";
    }
  };

  // ========== طريقة الدفع (Color) ==========
  const getPaymentColor = (): string => {
    switch (invoice.paymentType) {
      case PAYMENT_TYPES.CASH:
        return theme.colors.primary;
      case PAYMENT_TYPES.CREDIT:
        return theme.colors.error;
      case PAYMENT_TYPES.PARTIAL:
        return theme.colors.tertiary;
      default:
        return theme.colors.primary;
    }
  };

  // ========== طريقة الدفع (Label) ==========
  const getPaymentLabel = (): string => {
    switch (invoice.paymentType) {
      case PAYMENT_TYPES.CASH:
        return t("cash");
      case PAYMENT_TYPES.CREDIT:
        return t("credit");
      case PAYMENT_TYPES.PARTIAL:
        return t("partial");
      default:
        return invoice.paymentType;
    }
  };

  const isCancelled = invoice.status === DOCUMENT_STATUSES.CANCELLED;

  const totalAmount = itemsWithNames.reduce(
    (sum, { item }) => sum + item.total,
    0,
  );

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

        <Surface
          style={[styles.itemsCard, { backgroundColor: theme.colors.surface }]}
          elevation={1}
        >
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
                {itemsWithNames.length === 1 ? t("item") : t("items")})
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {CURRENCY_SYMBOL}
                {totalAmount.toFixed(2)}
              </Text>
            </View>

            {(invoice.serviceFee || 0) > 0 && (
              <View style={styles.summaryRow}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t("serviceFee") || "أجور الخدمات"}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {CURRENCY_SYMBOL}{(invoice.serviceFee || 0).toFixed(2)}
                </Text>
              </View>
            )}

            {(invoice.discountTotal || 0) > 0 && (
              <View style={styles.summaryRow}>
                <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
                  {t("discount") || "الخصم"}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
                  - {CURRENCY_SYMBOL}{(invoice.discountTotal || 0).toFixed(2)}
                </Text>
              </View>
            )}

            {(invoice.paidAmount || 0) > 0 && (
              <View style={styles.summaryRow}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t("paidAmount") || "المبلغ المدفوع"}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: "bold" }}>
                  {CURRENCY_SYMBOL}{(invoice.paidAmount || 0).toFixed(2)}
                </Text>
              </View>
            )}

            {(invoice.paymentType === PAYMENT_TYPES.CREDIT || invoice.paymentType === PAYMENT_TYPES.PARTIAL) && (
              <View style={styles.summaryRow}>
                <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
                  {t("remainingAmount") || "المبلغ المتبقي (آجل)"}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.error, fontWeight: "bold" }}>
                  {CURRENCY_SYMBOL}{(invoice.total - (invoice.paidAmount || 0)).toFixed(2)}
                </Text>
              </View>
            )}

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
        {invoice.status === DOCUMENT_STATUSES.DRAFT && !isCancelled && (
          <Button
            mode="contained"
            onPress={handlePost}
            loading={isPosting}
            disabled={isPosting}
            icon={paperIcon("check-circle-outline")}
            style={styles.shareButton}
            contentStyle={styles.buttonContent}
          >
            {t("post") || "ترحيل"}
          </Button>
        )}
        {isPostedStatus(invoice.status) && !isCancelled && (
          <Button
            mode="contained"
            buttonColor="#B42318"
            onPress={handleCancelPress}
            loading={isCancelling}
            disabled={isCancelling}
            icon={paperIcon("close-circle-outline")}
            style={styles.shareButton}
            contentStyle={styles.buttonContent}
          >
            {t("cancelInvoice") || "إلغاء الفاتورة"}
          </Button>
        )}
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

      <ConfirmDialog
        visible={showCancelDialog}
        title={t("confirmCancel") || "تأكيد الإلغاء"}
        message={
          t("cancelInvoiceMessage") ||
          "هل تريد إلغاء هذه الفاتورة؟ سيتم عكس القيود المحاسبية وإرجاع الكميات إلى المخزون."
        }
        confirmLabel={t("confirmCancelButton") || "نعم، ألغِ الفاتورة"}
        cancelLabel={t("cancel") || "تراجع"}
        destructive
        onConfirm={handleCancelConfirm}
        onDismiss={() => setShowCancelDialog(false)}
      />

      <LoadingOverlay visible={isGeneratingPdf} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollPadding: { height: 8 },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  cancelledAmount: { textDecorationLine: "line-through" },
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
  customerInfo: { flex: 1, gap: 2 },
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
  colHash: { width: 24, textAlign: "center" },
  colItem: { flex: 1, paddingHorizontal: 6 },
  colQty: { width: 36, textAlign: "center" },
  colRate: { width: 56, textAlign: "right" },
  colAmount: { width: 72, textAlign: "right", fontWeight: "600" },
  itemDivider: { marginHorizontal: 14, opacity: 0.5 },
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
  totalDivider: { marginVertical: 10 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
  },
  grandTotalValue: { fontWeight: "700" },
  bottomActions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  shareButton: { flex: 1, borderRadius: 10 },
  newBillButton: { flex: 1, borderRadius: 10 },
  buttonContent: { paddingVertical: 4 },
});



