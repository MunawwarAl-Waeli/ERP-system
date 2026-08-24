/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
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
} from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { EmptyState } from "@shared/components/EmptyState";
import { DateRangePicker } from "@shared/components/DateRangePicker";
import { paperIcon } from "@shared/components/Icon";
import {
  supplierRepository,
  SupplierLedgerItem,
} from "../repositories/supplierRepository";
import { formatDateTime } from "@shared/utils/date";
import { CURRENCY_SYMBOL } from "@core/constants";

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

  // حوار إنشاء سند صرف جديد للمورد
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const supp = await supplierRepository.getById(supplierId);
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
      console.log("Error loading supplier ledger:", error);
    } finally {
      setIsLoading(false);
    }
  }, [supplierId, startDate, endDate]);

  useEffect(() => {
    if (supplierId) {
      loadData();
    }
  }, [loadData, supplierId]);

  const handleMakePayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      await supplierRepository.addSupplierPayment(
        supplierId,
        amount,
        paymentNotes,
      );
      setShowPaymentDialog(false);
      setPaymentAmount("");
      setPaymentNotes("");
      loadData();
    } catch (error) {
      console.log("Error creating payment voucher:", error);
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
            icon="truck-delivery-outline"
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
        title={
          supplier ? `كشف حساب المورد: ${supplier.name}` : "كشف حساب الموردين"
        }
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scrollView}>
        {/* رأس الشاشة: بطاقة المورد والملخص المالي */}
        <Card
          style={[styles.headerCard, { backgroundColor: theme.colors.surface }]}
          mode="elevated"
        >
          <Card.Content>
            <View style={styles.summaryContainer}>
              <View>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {supplier?.name || "جار التحميل..."}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {supplier?.phone || ""}
                </Text>
              </View>
              <View style={styles.balanceBox}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  إجمالي المستحق للمورد
                </Text>
                <CurrencyText
                  amount={Math.abs(outstandingBalance)}
                  variant="headlineSmall"
                  color={
                    outstandingBalance > 0
                      ? theme.colors.error
                      : theme.colors.primary
                  }
                />
              </View>
            </View>

            <Button
              mode="contained"
              icon={paperIcon("cash-minus")}
              onPress={() => setShowPaymentDialog(true)}
              style={styles.payButton}
            >
              سداد دفعة للمورد
            </Button>
          </Card.Content>
        </Card>

        {/* شريط الفلاتر بالتاريخ */}
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

        {/* جدول حركات كشف الحساب */}
        <Surface style={styles.tableSurface} elevation={1}>
          <Text variant="titleMedium" style={styles.tableTitle}>
            سجل الحركات المالية ({transactions.length})
          </Text>
          <Divider style={{ marginBottom: 8 }} />

          {transactions.length === 0 && !isLoading ? (
            <EmptyState
              icon="file-document-outline"
              title="لا توجد حركات للمورد"
              subtitle="لم يتم تسجيل فواتير شراء أو سندات صرف خلال الفترة المحددة."
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

      {/* حوار سداد دفعة للمورد */}
      <Portal>
        <Dialog
          visible={showPaymentDialog}
          onDismiss={() => setShowPaymentDialog(false)}
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
            <Button onPress={() => setShowPaymentDialog(false)}>إلغاء</Button>
            <Button
              mode="contained"
              onPress={handleMakePayment}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
            >
              حفظ السداد
            </Button>
          </Dialog.Actions>
        </Dialog>
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
    alignItems: "center",
    marginBottom: 12,
  },
  balanceBox: { alignItems: "flex-end" },
  payButton: { marginTop: 8 },
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
  dialogInput: {
    marginBottom: 12,
  },
});
