/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import {
  Text,
  useTheme,
  Surface,
  Card,
  Divider,
  Button,
  Portal,
  Dialog,
  TextInput,
  Menu,
  Modal,
} from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { EmptyState } from "@shared/components/EmptyState";
import { DateRangePicker } from "@shared/components/DateRangePicker";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { notify } from "@shared/notifications";
import { services, repositories } from "src/application/compositionRoot";
import {
  supplierRepository,
  SupplierLedgerItem,
} from "../repositories/supplierRepository";
import { formatDateTime } from "@shared/utils/date";
import { CURRENCY_SYMBOL } from "@core/constants";
import { database } from "src/database";
import { Q } from "@nozbe/watermelondb";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const SupplierLedgerScreen: React.FC<{
  navigation: NavigationProp;
  route: { params?: { supplierId?: string } };
}> = ({ navigation, route }) => {
  const supplierId = route.params?.supplierId;
  const theme = useTheme();
  const { t } = useTranslation("suppliers");

  const [supplier, setSupplier] = useState<any>(null);
  const [transactions, setTransactions] = useState<SupplierLedgerItem[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Actions menu
  const [menuVisible, setMenuVisible] = useState(false);

  // Edit supplier modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Deactivate confirmation
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const loadData = useCallback(async () => {
    // ✅ حماية: لا نحاول التحميل إذا لم يصل supplierId
    if (!supplierId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      // ✅ القراءة من الخدمة (وليس المستودع)
      const supp = await services.supplier.getById(supplierId);

      // ⚠️ getOutstandingBalance و getDetailedLedger ليست في الخدمة بعد
      //    — هذه عمليات تقارير (CQRS read model)، تبقى على المستودع مؤقتاً
      const balance = await supplierRepository.getOutstandingBalance(
        supplierId,
      );
      const ledger = await supplierRepository.getDetailedLedger(
        supplierId,
        startDate,
        endDate,
      );
      setSupplier(supp);
      setOutstandingBalance(balance);
      setTransactions(ledger);
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "فشل تحميل بيانات المورد",
      );
    } finally {
      setIsLoading(false);
    }
  }, [supplierId, startDate, endDate]);

  useEffect(() => {
    if (supplierId) {
      loadData();
    }
  }, [loadData, supplierId]);

  const openEdit = () => {
    setMenuVisible(false);
    setEditName(supplier?.name || "");
    setEditPhone(supplier?.phone || "");
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      notify.warning("اسم المورد مطلوب");
      return;
    }
    if (!supplier || isSavingEdit) return;

    setIsSavingEdit(true);
    try {
      await services.supplier.update(supplier.id, {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        address: undefined,
      });
      notify.success("تم تحديث بيانات المورد");
      setShowEditModal(false);
      await loadData();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "فشل تحديث المورد");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeactivate = async () => {
    if (!supplier) return;
    const name = supplier.name;
    setShowDeactivateConfirm(false);
    try {
      await services.supplier.deactivate(supplier.id);
      notify.success(`تم تعطيل المورد "${name}"`);
      navigation.goBack();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "فشل تعطيل المورد");
    }
  };

  const handleMakePayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      notify.warning("المبلغ غير صحيح");
      return;
    }
    if (!supplierId || isSavingPayment) return;

    setIsSavingPayment(true);
    try {
      // 1. جلب حساب الصندوق الافتراضي من إعدادات المحاسبة
      const settings = await repositories.accountingSetting.get();
      if (!settings?.cashDefaultAccountId) {
        throw new Error(
          "لم يتم إعداد حساب الصندوق الافتراضي. يرجى ضبطه من شاشة الإعدادات المحاسبية.",
        );
      }

      // 2. استدعاء الخدمة الرسمية — كل شيء ذري في خطوة واحدة:
      //    - تخصيص FIFO على الفواتير المفتوحة
      //    - توليد رقم سند رسمي (PV-YYYYMMDD-XXXXXX)
      //    - إنشاء القيد المحاسبي
      //    - تحديث paidAmount للفواتير
      await services.paymentVoucher.autoAllocateToSupplier({
        voucherDate: new Date().toISOString().slice(0, 10),
        paymentAccountId: settings.cashDefaultAccountId,
        supplierId,
        amount,
        description: paymentNotes.trim() || "سداد دفعة للمورد",
        createdBy: "local-user",
      });

      notify.success("تم تسجيل السداد بنجاح");
      setShowPaymentDialog(false);
      setPaymentAmount("");
      setPaymentNotes("");
      await loadData();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "فشل تسجيل السداد");
    } finally {
      setIsSavingPayment(false);
    }
  };

  const renderTransactionItem = ({ item }: { item: SupplierLedgerItem }) => {
    const isPurchase = item.type === "purchase_invoice";
    const label = isPurchase ? "فاتورة شراء" : "سند صرف";
    const variant = isPurchase ? "warning" : "success";

    return (
      <View
        style={[
          styles.rowContainer,
          { borderBottomColor: theme.colors.surfaceVariant },
        ]}
      >
        <View style={styles.rowHeader}>
          <StatusBadge label={label} variant={variant} compact />
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {formatDateTime(item.date)}
          </Text>
        </View>

        <Text variant="bodyMedium" style={styles.descriptionText}>
          {item.description}
        </Text>

        <View style={styles.rowFinancials}>
          <View style={styles.colAmount}>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              مدين (سداد)
            </Text>
            <CurrencyText
              amount={item.debit}
              variant="bodyMedium"
              color={item.debit > 0 ? theme.colors.primary : undefined}
            />
          </View>

          <View style={styles.colAmount}>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              دائن (فاتورة)
            </Text>
            <CurrencyText
              amount={item.credit}
              variant="bodyMedium"
              color={item.credit > 0 ? theme.colors.error : undefined}
            />
          </View>

          <View style={styles.colAmount}>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              الرصيد المتبقي
            </Text>
            <CurrencyText
              amount={item.runningBalance}
              variant="titleSmall"
              color={
                item.runningBalance > 0
                  ? theme.colors.error
                  : theme.colors.primary
              }
            />
          </View>
        </View>
      </View>
    );
  };

  if (!supplierId) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <AppHeader
          title="كشف حساب المورد"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <EmptyState
            icon="truck-delivery"
            title="لم يتم اختيار مورد"
            subtitle="يرجى العودة واختيار مورد من القائمة لعرض كشف حسابه."
          />
          <Button
            mode="contained"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 20 }}
          >
            العودة للقائمة
          </Button>
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
        title={supplier ? `كشف حساب: ${supplier.name}` : "كشف حساب المورد"}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scrollView}>
        {/* Header card */}
        <Card
          style={[styles.headerCard, { backgroundColor: theme.colors.surface }]}
          mode="elevated"
        >
          <Card.Content>
            {/* ─── الاسم + ⋮ ─── */}
            <View style={styles.headerTopRow}>
              <Text
                variant="titleLarge"
                style={styles.supplierName}
                numberOfLines={2}
              >
                {supplier?.name || "جار التحميل..."}
              </Text>

              {supplier && (
                <Menu
                  visible={menuVisible}
                  onDismiss={() => setMenuVisible(false)}
                  anchor={
                    <TouchableOpacity
                      onPress={() => setMenuVisible(true)}
                      hitSlop={12}
                      style={styles.menuAnchor}
                    >
                      <AppIcon
                        name="dots-vertical"
                        size={22}
                        color={theme.colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                  }
                  anchorPosition="bottom"
                >
                  <Menu.Item
                    onPress={openEdit}
                    title="تعديل البيانات"
                    leadingIcon={({ size, color }) => (
                      <AppIcon name="pencil" size={size} color={color} />
                    )}
                  />
                  <Divider />
                  <Menu.Item
                    onPress={() => {
                      setMenuVisible(false);
                      setShowDeactivateConfirm(true);
                    }}
                    title="تعطيل المورد"
                    titleStyle={{ color: theme.colors.error }}
                    leadingIcon={({ size }) => (
                      <AppIcon
                        name="delete"
                        size={size}
                        color={theme.colors.error}
                      />
                    )}
                  />
                </Menu>
              )}
            </View>

            {/* ─── الهاتف ─── */}
            {supplier?.phone ? (
              <View style={styles.phoneRow}>
                <AppIcon
                  name="phone"
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {supplier.phone}
                </Text>
              </View>
            ) : null}

            <Divider style={{ marginVertical: 14 }} />

            {/* ─── الرصيد في سطر واحد ─── */}
            <View style={styles.balanceRow}>
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontWeight: "600",
                }}
              >
                المستحق للمورد
              </Text>
              <Text
                variant="headlineSmall"
                style={{
                  fontWeight: "700",
                  color:
                    outstandingBalance > 0
                      ? theme.colors.error
                      : theme.colors.primary,
                }}
              >
                {Math.abs(outstandingBalance).toFixed(2)}{" "}
                <Text
                  variant="bodyMedium"
                  style={{
                    color:
                      outstandingBalance > 0
                        ? theme.colors.error
                        : theme.colors.primary,
                  }}
                >
                  ر.ي
                </Text>
              </Text>
            </View>

            {/* ─── زر السداد compact ─── */}
            <Button
              mode="contained"
              icon={paperIcon("cash")}
              onPress={() => setShowPaymentDialog(true)}
              style={styles.payButton}
              contentStyle={styles.payButtonContent}
              compact
            >
              سداد دفعة للمورد
            </Button>
          </Card.Content>
        </Card>
        {/* Filters */}
        <Surface style={styles.filterSurface} elevation={1}>
          <Text variant="titleSmall" style={styles.filterTitle}>
            تصفية حسب الفترة الزمنية
          </Text>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </Surface>

        {/* Transactions */}
        <Surface style={styles.tableSurface} elevation={1}>
          <Text variant="titleMedium" style={styles.tableTitle}>
            سجل الحركات المالية ({transactions.length})
          </Text>
          <Divider style={{ marginBottom: 8 }} />

          {transactions.length === 0 && !isLoading ? (
            <EmptyState
              icon="file-text"
              title="لا توجد حركات للمورد"
              subtitle="لم يتم تسجيل فواتير شراء أو سندات صرف خلال الفترة المحددة."
            />
          ) : (
            <FlashList
              data={transactions}
              renderItem={renderTransactionItem}
              keyExtractor={(item) => item.id + item.date.toString()}
              // estimatedItemSize={100}
              scrollEnabled={false}
            />
          )}
        </Surface>
      </ScrollView>

      <Portal>
        {/* Payment dialog */}
        <Dialog
          visible={showPaymentDialog}
          onDismiss={() => !isSavingPayment && setShowPaymentDialog(false)}
        >
          <Dialog.Title>سداد دفعة للمورد</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="المبلغ المدفوع"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="numeric"
              mode="outlined"
              left={<TextInput.Affix text={CURRENCY_SYMBOL} />}
              style={styles.dialogInput}
            />
            <TextInput
              label="ملاحظات / البيان"
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              mode="outlined"
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setShowPaymentDialog(false)}
              disabled={isSavingPayment}
            >
              إلغاء
            </Button>
            <Button
              mode="contained"
              onPress={handleMakePayment}
              disabled={
                !paymentAmount ||
                parseFloat(paymentAmount) <= 0 ||
                isSavingPayment
              }
              loading={isSavingPayment}
            >
              حفظ السداد
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Edit supplier modal */}
        <Modal
          visible={showEditModal}
          onDismiss={() => !isSavingEdit && setShowEditModal(false)}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <View style={styles.modalHeader}>
            <View
              style={[
                styles.modalIconCircle,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <AppIcon name="pencil" size={22} color={theme.colors.primary} />
            </View>
            <Text variant="titleLarge" style={styles.modalTitle}>
              تعديل بيانات المورد
            </Text>
            <Button
              compact
              onPress={() => !isSavingEdit && setShowEditModal(false)}
              icon={() => (
                <AppIcon
                  name="close"
                  size={22}
                  color={theme.colors.onSurfaceVariant}
                />
              )}
            />
          </View>

          <View style={styles.modalBody}>
            <TextInput
              label="اسم المورد"
              value={editName}
              onChangeText={setEditName}
              mode="outlined"
              style={styles.input}
              right={
                <TextInput.Icon
                  icon={({ size, color }) => (
                    <AppIcon name="user" size={size} color={color} />
                  )}
                />
              }
              autoFocus
            />
            <TextInput
              label="رقم الهاتف (اختياري)"
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
              right={
                <TextInput.Icon
                  icon={({ size, color }) => (
                    <AppIcon name="phone" size={size} color={color} />
                  )}
                />
              }
            />
          </View>

          <View style={styles.modalFooter}>
            <Button
              mode="outlined"
              onPress={() => setShowEditModal(false)}
              style={styles.footerBtn}
              disabled={isSavingEdit}
            >
              إلغاء
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveEdit}
              style={styles.footerBtn}
              disabled={!editName.trim() || isSavingEdit}
              loading={isSavingEdit}
            >
              حفظ التعديلات
            </Button>
          </View>
        </Modal>

        {/* Deactivate confirmation */}
        <ConfirmDialog
          visible={showDeactivateConfirm}
          title="تعطيل المورد"
          message={
            supplier
              ? `سيتم تعطيل "${supplier.name}". لن يظهر في القوائم الجديدة، لكن تاريخه المالي (الفواتير والدفعات) سيبقى محفوظاً.`
              : ""
          }
          confirmLabel="تعطيل"
          cancelLabel="إلغاء"
          destructive
          onConfirm={handleDeactivate}
          onDismiss={() => setShowDeactivateConfirm(false)}
        />
      </Portal>
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
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  balanceBox: { alignItems: "flex-start" },

  filterSurface: { padding: 16, borderRadius: 12, marginBottom: 16 },
  filterTitle: { marginBottom: 8, fontWeight: "bold" },

  tableSurface: { padding: 16, borderRadius: 12, marginBottom: 40 },
  tableTitle: { marginBottom: 12, fontWeight: "bold" },

  rowContainer: { paddingVertical: 12, borderBottomWidth: 1 },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  descriptionText: {
    marginBottom: 8,
    fontWeight: "500",
    textAlign: "right",
    writingDirection: "rtl",
  },
  rowFinancials: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.02)",
    padding: 8,
    borderRadius: 8,
  },
  colAmount: { alignItems: "center", flex: 1 },

  dialogInput: { marginBottom: 12 },

  modalContainer: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 0,
    overflow: "hidden",
    alignSelf: "center",
    width: "90%",
    maxWidth: 460,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  supplierName: {
    flex: 1,
    fontWeight: "700",
    fontSize: 18,
  },
  menuAnchor: {
    padding: 4,
    marginTop: 2,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  payButton: {
    marginTop: 16,
    borderRadius: 10,
  },
  payButtonContent: {
    height: 42,
    flexDirection: "row",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  modalIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    flex: 1,
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
    fontSize: 18,
  },
  modalBody: { padding: 18, paddingTop: 16 },
  input: { marginBottom: 12, backgroundColor: "transparent" },
  modalFooter: {
    flexDirection: "row",
    padding: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  footerBtn: { flex: 1, borderRadius: 10 },
});
