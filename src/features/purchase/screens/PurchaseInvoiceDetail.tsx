// screens/PurchaseInvoiceDetail.tsx
import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import {
  useTheme,
  Card,
  Button,
  Divider,
  Chip,
  Text,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { paperIcon } from "@shared/components/Icon";
import { usePurchaseInvoiceDetail } from "../hooks/usePurchaseInvoices";
import {
  PurchaseInvoiceStatus,
  purchaseRepository,
} from "../repositories/purchaseRepository";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const PurchaseInvoiceDetail: React.FC<{
  navigation: NavigationProp;
  route: { params: { invoiceId: string } };
}> = ({ navigation, route }) => {
  const { invoiceId } = route.params;
  const theme = useTheme();
  const { t } = useTranslation("purchases");
  const { invoice, items, isLoading, error } =
    usePurchaseInvoiceDetail(invoiceId);

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // حالة التحميل
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

  // عرض الخطأ
  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <AppHeader
          title={t("invoiceDetails")}
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Text style={{ color: theme.colors.error }}>{error.message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ========== معالجة الترحيل ==========
  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await purchaseRepository.approve(invoiceId);
      setShowApproveDialog(false);
      Alert.alert(t("common:success"), t("invoiceApproved"));
    } catch (err) {
      Alert.alert(
        t("common:error"),
        err instanceof Error ? err.message : t("common:operationFailed"),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ========== معالجة الإلغاء ==========
  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      await purchaseRepository.cancel(invoiceId);
      setShowCancelDialog(false);
      Alert.alert(t("common:success"), t("invoiceCancelled"));
      if (invoice.status === "draft") {
        navigation.goBack(); // إذا كانت مسودة وحُذفت، ارجع للخلف
      }
    } catch (err) {
      Alert.alert(
        t("common:error"),
        err instanceof Error ? err.message : t("common:operationFailed"),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ========== حالة الفاتورة ==========
  const getStatusVariant = (
    status: PurchaseInvoiceStatus,
  ): "info" | "success" | "error" | "warning" => {
    switch (status) {
      case "draft":
        return "warning";
      case "approved":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "info";
    }
  };

  const getPaymentTypeLabel = (type: string): string => {
    switch (type) {
      case "cash":
        return t("cash");
      case "credit":
        return t("credit");
      case "partial":
        return t("partial");
      default:
        return type;
    }
  };

  // ========== عرض البنود ==========
  const renderItems = () => {
    if (items.length === 0) {
      return (
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            textAlign: "center",
            padding: 16,
          }}
        >
          {t("noItems")}
        </Text>
      );
    }

    return items.map((item, index) => (
      <View key={item.id || index} style={styles.itemRow}>
        <View style={styles.itemLeft}>
          <Text variant="bodyMedium" style={{ fontWeight: "500" }}>
            {item.product?.name || "منتج"}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {item.quantity} × {item.unitCost} ={" "}
            <CurrencyText amount={item.total} />
          </Text>
        </View>
        <CurrencyText
          amount={item.total}
          variant="bodyMedium"
          style={{ fontWeight: "600" }}
        />
      </View>
    ));
  };

  // ========== عرض أزرار الإجراءات ==========
  const renderActions = () => {
    switch (invoice.status) {
      case "draft":
        return (
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              icon={paperIcon("pencil")}
              onPress={() =>
                navigation.navigate("PurchaseInvoiceForm", { invoiceId })
              }
              style={styles.actionButton}
            >
              {t("edit")}
            </Button>
            <Button
              mode="contained"
              icon={paperIcon("check")}
              onPress={() => setShowApproveDialog(true)}
              style={styles.actionButton}
              loading={isProcessing}
            >
              {t("approve")}
            </Button>
            <Button
              mode="outlined"
              icon={paperIcon("delete")}
              onPress={() => setShowCancelDialog(true)}
              style={[styles.actionButton, { borderColor: theme.colors.error }]}
              textColor={theme.colors.error}
            >
              {t("cancel")}
            </Button>
          </View>
        );

      case "approved":
        return (
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              icon={paperIcon("file-pdf-box")}
              onPress={() => Alert.alert(t("print"), t("printMessage"))}
              style={styles.actionButton}
            >
              {t("print")}
            </Button>
            <Button
              mode="outlined"
              icon={paperIcon("close")}
              onPress={() => setShowCancelDialog(true)}
              style={[styles.actionButton, { borderColor: theme.colors.error }]}
              textColor={theme.colors.error}
            >
              {t("cancelInvoice")}
            </Button>
          </View>
        );

      case "cancelled":
        return (
          <View style={styles.actionButtons}>
            <Chip icon="information" style={{ alignSelf: "center" }}>
              {t("invoiceCancelledMessage")}
            </Chip>
          </View>
        );

      default:
        return null;
    }
  };

  // ========== التصميم ==========
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={t("invoiceDetails")}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scrollView}>
        {/* ===== بطاقة الفاتورة ===== */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.headerRow}>
              <View>
                <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
                  {invoice.invoiceNumber || `#${invoice.id.slice(0, 8)}`}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {new Date(invoice.invoiceDate).toLocaleDateString()}
                </Text>
              </View>
              <StatusBadge
                label={t(`status.${invoice.status}`)}
                variant={getStatusVariant(invoice.status)}
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.infoRow}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("supplier")}
              </Text>
              <Text variant="bodyMedium">
                {invoice.supplier?.name || t("noSupplier")}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("paymentType")}
              </Text>
              <Text variant="bodyMedium">
                {getPaymentTypeLabel(invoice.paymentType)}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("total")}
              </Text>
              <CurrencyText
                amount={invoice.total}
                variant="titleMedium"
                style={{ fontWeight: "bold" }}
              />
            </View>

            {invoice.paidAmount > 0 && (
              <View style={styles.infoRow}>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("paidAmount")}
                </Text>
                <CurrencyText
                  amount={invoice.paidAmount}
                  variant="bodyMedium"
                />
              </View>
            )}

            {invoice.paidAmount < invoice.total &&
              invoice.status === "approved" && (
                <View style={styles.infoRow}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {t("remainingAmount")}
                  </Text>
                  <CurrencyText
                    amount={invoice.total - invoice.paidAmount}
                    variant="bodyMedium"
                    style={{ color: theme.colors.primary }}
                  />
                </View>
              )}
          </Card.Content>
        </Card>

        {/* ===== بطاقة البنود ===== */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t("items")}
            </Text>
            {renderItems()}
          </Card.Content>
        </Card>

        {/* ===== أزرار الإجراءات ===== */}
        <View style={styles.actionsContainer}>{renderActions()}</View>
      </ScrollView>

      {/* ===== حوارات التأكيد ===== */}
      <ConfirmDialog
        visible={showApproveDialog}
        title={t("confirmApprove")}
        message={t("approveMessage")}
        confirmLabel={t("common:confirm")}
        onConfirm={handleApprove}
        onDismiss={() => setShowApproveDialog(false)}
        loading={isProcessing}
      />

      <ConfirmDialog
        visible={showCancelDialog}
        title={t("confirmCancel")}
        message={
          invoice.status === "draft"
            ? t("cancelDraftMessage")
            : t("cancelApprovedMessage")
        }
        confirmLabel={t("common:confirm")}
        onConfirm={handleCancel}
        onDismiss={() => setShowCancelDialog(false)}
        destructive
        loading={isProcessing}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, padding: 16 },
  card: { marginBottom: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  divider: { marginVertical: 12 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionTitle: {
    fontWeight: "700",
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  itemLeft: { flex: 1, marginRight: 8 },
  actionsContainer: {
    marginBottom: 40,
  },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});
