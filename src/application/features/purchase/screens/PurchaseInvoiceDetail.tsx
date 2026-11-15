// screens/PurchaseInvoiceDetail.tsx
import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  useTheme,
  Card,
  Button,
  Divider,
  Chip,
  Text,
  Portal,
  Modal,
  TextInput,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { AppIcon } from "@shared/components/Icon";
import { notify } from "@shared/notifications";
import { services } from "src/application/compositionRoot";

import { usePurchaseInvoiceDetail } from "../hooks/usePurchaseInvoices";
import { useInvoiceDisplayData } from "../hooks/useInvoiceDisplayData";

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

  const [supplierName, setSupplierName] = useState<string>(t("noSupplier"));
  const [productNames, setProductNames] = useState<Record<string, string>>({});

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paidAmountInput, setPaidAmountInput] = useState("");

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

  // ─── الترحيل ───
  const handleApprove = async (presetAmount?: number) => {
    let finalAmount: number | undefined = undefined;

    if (invoice.paymentType === "cash") {
      finalAmount = invoice.total;
    } else if (invoice.paymentType === "partial") {
      const candidate =
        (invoice.paidAmount > 0 ? invoice.paidAmount : undefined) ??
        presetAmount ??
        parseFloat(paidAmountInput) ??
        0;

      if (!candidate || candidate <= 0) {
        notify.warning("الرجاء إدخال مبلغ صحيح للدفعة الجزئية");
        return;
      }
      if (candidate >= invoice.total) {
        notify.warning("الدفعة الجزئية يجب أن تكون أقل من إجمالي الفاتورة");
        return;
      }
      finalAmount = candidate;
    } else {
      finalAmount = 0;
    }

    setIsProcessing(true);
    try {
      await services.purchaseInvoice.post(invoiceId, finalAmount);
      setShowApproveDialog(false);
      notify.success(t("invoiceApproved"));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "فشل الترحيل");
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── الإلغاء ───
  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      if (invoice.status === "draft") {
        await services.purchaseInvoice.deleteDraft(invoiceId);
        notify.success("تم حذف المسودة بنجاح");
        navigation.goBack();
      } else {
        await services.purchaseInvoice.cancel(
          invoiceId,
          new Date().toISOString().slice(0, 10),
        );
        setShowCancelDialog(false);
        notify.success(t("invoiceCancelled"));
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "فشل الإلغاء");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusVariant = (
    status: string,
  ): "info" | "success" | "error" | "warning" => {
    switch (status) {
      case "draft":
        return "warning";
      case "posted":
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
    return items.map((item, index) => {
      const pId = (item as any).productId;
      return (
        <View key={item.id || index} style={styles.itemRow}>
          <View style={styles.itemLeft}>
            <Text variant="bodyMedium" style={{ fontWeight: "500" }}>
              {productNames[pId] || t("product")}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {item.quantity} × {item.unitCost}
            </Text>
          </View>
          <CurrencyText
            amount={item.total}
            variant="bodyMedium"
            style={{ fontWeight: "600" }}
          />
        </View>
      );
    });
  };

  const renderActions = () => {
    switch (invoice.status as string) {
      case "draft":
        return (
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              icon={() => <AppIcon name="pencil" size={18} />}
              onPress={() =>
                navigation.navigate("PurchaseInvoiceEdit", { invoiceId })
              }
              style={styles.actionButton}
            >
              {t("edit")}
            </Button>
            {/* ✅ الإصلاح: الزر يفتح نافذة التأكيد دائماً */}
            <Button
              mode="contained"
              icon={() => <AppIcon name="check" size={18} color="#fff" />}
              onPress={() => setShowApproveDialog(true)}
              style={styles.actionButton}
              loading={isProcessing}
            >
              {t("approve")}
            </Button>
            <Button
              mode="outlined"
              icon={() => <AppIcon name="delete" size={18} />}
              onPress={() => setShowCancelDialog(true)}
              style={[styles.actionButton, { borderColor: theme.colors.error }]}
              textColor={theme.colors.error}
            >
              {t("cancel")}
            </Button>
          </View>
        );
      case "approved":
      case "posted":
        return (
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              icon={() => <AppIcon name="printer" size={18} />}
              onPress={() => notify.info(t("printMessage"))}
              style={styles.actionButton}
            >
              {t("print")}
            </Button>
            <Button
              mode="outlined"
              icon={() => <AppIcon name="close" size={18} />}
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
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.headerRow}>
              <View>
                <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
                  {invoice.invoiceNumber || t("draftLabel")}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {new Date(invoice.invoiceDate).toLocaleDateString("ar-EG")}
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
              <Text variant="bodyMedium" style={{ fontWeight: "600" }}>
                {supplierName}
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
              invoice.status === "posted" && (
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

        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t("items")}
            </Text>
            {renderItems()}
          </Card.Content>
        </Card>

        <View style={styles.actionsContainer}>{renderActions()}</View>
      </ScrollView>

      <Portal>
        <Modal
          visible={showApproveDialog}
          onDismiss={() => !isProcessing && setShowApproveDialog(false)}
          contentContainerStyle={[
            styles.modalContent,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text
            variant="titleLarge"
            style={{ textAlign: "center", marginBottom: 12 }}
          >
            {t("confirmApprove")}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ textAlign: "center", marginBottom: 16 }}
          >
            {t("approveMessage")}
          </Text>

          {invoice.paymentType === "partial" && invoice.paidAmount === 0 && (
            <TextInput
              label="المبلغ المدفوع الآن"
              value={paidAmountInput}
              onChangeText={setPaidAmountInput}
              keyboardType="numeric"
              mode="outlined"
              style={{ marginBottom: 16 }}
              right={<TextInput.Affix text="ر.ي" />}
              autoFocus
            />
          )}

          <View style={{ flexDirection: "row-reverse", gap: 10 }}>
            <Button
              mode="contained"
              onPress={() => handleApprove()}
              loading={isProcessing}
              disabled={isProcessing}
              style={{ flex: 1 }}
            >
              {t("approve")}
            </Button>
            <Button
              mode="outlined"
              onPress={() => setShowApproveDialog(false)}
              disabled={isProcessing}
              style={{ flex: 1 }}
            >
              {t("cancel")}
            </Button>
          </View>
        </Modal>
      </Portal>

      <ConfirmDialog
        visible={showCancelDialog}
        title={t("confirmCancel")}
        message={
          invoice.status === "draft"
            ? t("cancelDraftMessage")
            : t("cancelApprovedMessage")
        }
        confirmLabel={t("cancel")}
        cancelLabel={t("common:cancel")}
        onConfirm={handleCancel}
        onDismiss={() => setShowCancelDialog(false)}
        destructive
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
  sectionTitle: { fontWeight: "700", marginBottom: 12 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  itemLeft: { flex: 1, marginRight: 8 },
  actionsContainer: { marginBottom: 40 },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  actionButton: { flex: 1, minWidth: 100 },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: { margin: 20, padding: 24, borderRadius: 12 },
});
