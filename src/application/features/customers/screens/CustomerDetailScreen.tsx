import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Linking, Pressable } from "react-native";
import { Text, Surface, Button } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@shared/components/AppHeader";
import { AppIcon } from "src/shared/components/Icon";
import { CurrencyText } from "@shared/components/CurrencyText";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { CreditLedger } from "../components/CreditLedger";
import { PaymentDialog } from "../components/PaymentDialog";
import { useCustomerDetail } from "../hooks/useCustomers";
import { customerRepository } from "../repositories/customerRepository";
import { notify } from "@shared/notifications";
import { Colors } from "src/core/theme/colors";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const CustomerDetailScreen: React.FC<{
  navigation: NavigationProp;
  route: { params: { customerId: string } };
}> = ({ navigation, route }) => {
  const { customerId } = route.params;
  const { t } = useTranslation("customers");
  const { customer, outstandingCredit, isLoading } =
    useCustomerDetail(customerId);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const handleDelete = async () => {
    try {
      await customerRepository.deactivate(customerId);
      setShowDeleteDialog(false);
      notify.success(t("customerDeleted") || "تم تعطيل العميل بنجاح");
      navigation.goBack();
    } catch {
      notify.error(t("common:operationFailed") || "فشلت العملية");
    }
  };

  const handleCollectPayment = async (amount: number, notes: string) => {
    setIsSavingPayment(true);
    try {
      await customerRepository.addCreditPayment(customerId, amount, notes);
      setShowPaymentDialog(false);
      notify.success(t("paymentRecorded") || "تم تسجيل الدفعة بنجاح");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "فشلت العملية");
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleCall = useCallback(() => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  }, [customer?.phone]);

  const handleWhatsapp = useCallback(() => {
    if (customer?.phone) {
      const msg = `مرحباً ${customer.name}، نود تذكيركم بأن الرصيد المستحق لحسابكم هو ${outstandingCredit} ر.ي.`;
      Linking.openURL(
        `https://wa.me/${customer.phone}?text=${encodeURIComponent(msg)}`,
      );
    }
  }, [customer, outstandingCredit]);

  if (isLoading || !customer) {
    return <LoadingOverlay visible />;
  }

  const hasDebt = outstandingCredit > 0;
  const avatarLetter = customer.name.trim().charAt(0) || "ع";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors.background }]}
      edges={["top"]}
    >
      {/* الترويسة العليا */}
      <AppHeader
        title={customer.name}
        showBack
        onBack={() => navigation.goBack()}
        actions={[
          {
            icon: "pencil",
            onPress: () => navigation.navigate("CustomerForm", { customerId }),
          },
          {
            icon: "delete",
            onPress: () => setShowDeleteDialog(true),
          },
        ]}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. بطاقة معلومات العميل والتواصل السريع */}
        <Surface style={styles.card} elevation={0}>
          <View style={styles.profileHeader}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: hasDebt ? Colors.errorBg : Colors.successBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: hasDebt ? Colors.creditRed : Colors.paymentGreen },
                ]}
              >
                {avatarLetter}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.customerName}>{customer.name}</Text>
              <Text style={styles.phoneText}>
                {customer.phone || t("noPhone") || "بدون رقم هاتف"}
              </Text>
            </View>

            {/* أزرار الاتصال والواتساب السريعة */}
            <View style={styles.quickActions}>
              {customer.phone && (
                <>
                  <Pressable style={styles.iconBtn} onPress={handleCall}>
                    <AppIcon
                      name="phone"
                      size={16}
                      color={Colors.onSurfaceVariant}
                    />
                  </Pressable>
                  <Pressable style={styles.iconBtn} onPress={handleWhatsapp}>
                    <AppIcon
                      name="whatsapp"
                      size={16}
                      color={Colors.paymentGreen}
                    />
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {(customer.address || customer.notes) && (
            <View style={styles.divider} />
          )}

          {customer.address ? (
            <View style={styles.infoRow}>
              <AppIcon name="map-marker" size={14} color={Colors.neutralText} />
              <Text style={styles.infoText}>{customer.address}</Text>
            </View>
          ) : null}

          {customer.notes ? (
            <View style={styles.infoRow}>
              <AppIcon name="note-text" size={14} color={Colors.neutralText} />
              <Text style={styles.infoText}>{customer.notes}</Text>
            </View>
          ) : null}
        </Surface>

        {/* 2. بطاقة الرصيد المستحق وتحصيل الدفعات */}
        <Surface
          style={[
            styles.card,
            {
              backgroundColor: hasDebt ? Colors.errorBg : Colors.surface,
              borderColor: hasDebt ? Colors.errorLight : Colors.border,
            },
          ]}
          elevation={0}
        >
          <View style={styles.creditHeader}>
            <View>
              <Text style={styles.creditLabel}>
                {hasDebt
                  ? t("outstandingCredit") || "الرصيد المستحق عليه"
                  : t("advanceBalance") || "الحساب متوازن / رصيد مقدم"}
              </Text>

              <View style={styles.amountRow}>
                <CurrencyText
                  amount={Math.abs(outstandingCredit)}
                  variant="headlineSmall"
                  color={hasDebt ? Colors.creditRed : Colors.paymentGreen}
                />
              </View>
            </View>

            {/* زر تحصيل دفعة */}
            <Button
              mode="contained"
              icon={({ size, color }) => (
                <AppIcon name="cash-plus" size={size} color={color} />
              )}
              onPress={() => setShowPaymentDialog(true)}
              style={[styles.collectBtn, { backgroundColor: Colors.primary }]}
              labelStyle={styles.btnLabel}
            >
              {t("collectPayment") || "تسجيل دفعة"}
            </Button>
          </View>
        </Surface>

        {/* 3. زر الانتقال لكشف الحساب التفصيلي */}
        <Button
          mode="outlined"
          icon={({ size, color }) => (
            <AppIcon name="receipt-text-outline" size={size} color={color} />
          )}
          onPress={() => navigation.navigate("CustomerLedger", { customerId })}
          style={styles.ledgerBtn}
          textColor={Colors.primary}
        >
          {t("viewDetailedLedger") || "عرض كشف الحساب التفصيلي"}
        </Button>

        {/* 4. سجل الحركات المختصر */}
        <View style={styles.ledgerSection}>
          <Text style={styles.sectionTitle}>
            {t("creditHistory") || "آخر الحركات المسجلة"}
          </Text>
          <CreditLedger customerId={customerId} />
        </View>
      </ScrollView>

      {/* نافذة تأكيد الحذف */}
      <ConfirmDialog
        visible={showDeleteDialog}
        title={t("deleteCustomer") || "تعطيل حساب العميل"}
        message={
          t("deleteConfirm") || "هل أنت أصل من رغبتك في تعطيل هذا العميل؟"
        }
        confirmLabel={t("common:delete") || "تعطيل"}
        onConfirm={handleDelete}
        onDismiss={() => setShowDeleteDialog(false)}
        destructive
      />

      {/* نافذة تسجيل الدفعة الموحدة */}
      <PaymentDialog
        visible={showPaymentDialog}
        onDismiss={() => setShowPaymentDialog(false)}
        onSubmit={handleCollectPayment}
        maxAmount={outstandingCredit}
        isLoading={isSavingPayment}
      />
    </SafeAreaView>
  );
};

export default CustomerDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  profileInfo: {
    flex: 1,
    marginHorizontal: 10,
    alignItems: "flex-start",
  },
  customerName: {
    fontSize: 15,
    fontWeight: "bold",
    color: Colors.onSurface,
    marginBottom: 2,
  },
  phoneText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontWeight: "500",
  },
  quickActions: {
    flexDirection: "row",
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: Colors.surfaceVariant,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceVariant,
    marginVertical: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  infoText: {
    fontSize: 11.5,
    color: Colors.onSurfaceVariant,
  },
  creditHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  creditLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.neutralText,
  },
  amountRow: {
    marginTop: 2,
  },
  collectBtn: {
    borderRadius: 8,
  },
  btnLabel: {
    fontSize: 12,
    fontWeight: "bold",
  },
  ledgerBtn: {
    borderColor: Colors.primary,
    borderRadius: 8,
    marginBottom: 12,
  },
  ledgerSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
});
