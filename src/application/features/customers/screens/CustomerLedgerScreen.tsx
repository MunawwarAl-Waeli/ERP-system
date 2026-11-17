import React, { useState, useMemo, useCallback } from "react";
import {
  StyleSheet,
  View,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Text, useTheme, Surface, Button, Chip } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { FlashList } from "@shopify/flash-list";

import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { AppIcon } from "src/shared/components/Icon";
import { formatDateTime } from "@shared/utils/date";

import { useCustomerDetail } from "../hooks/useCustomers";
import { useCustomerLedger } from "../hooks/useCustomerLedger";
import { customerPdfService } from "../services/customerPdfService";
import { LedgerTransactionItem } from "../repositories/customerRepository";
import { notify } from "@shared/notifications";
import { Colors } from "src/core/theme/colors";

// ========================================
// 1. Types & Interfaces
// ========================================

type FilterPeriod = "all" | "30days" | "month" | "custom";

interface RouteParams {
  customerId: string;
}

interface CustomerLedgerScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
  route: {
    params: RouteParams;
  };
}

// ========================================
// 2. Component Implementation
// ========================================

export const CustomerLedgerScreen: React.FC<CustomerLedgerScreenProps> = ({
  navigation,
  route,
}) => {
  const { customerId } = route.params;
  const theme = useTheme();
  const { t } = useTranslation("customers");

  const { customer, isLoading: isCustomerLoading } =
    useCustomerDetail(customerId);
  const {
    transactions = [],
    outstandingBalance = 0,
    isLoading: isLedgerLoading,
  } = useCustomerLedger(customerId);

  // حالات الفلترة والتواريخ
  const [filter, setFilter] = useState<FilterPeriod>("all");
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  const [showPicker, setShowPicker] = useState<"start" | "end" | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // ============ تصفية الحركات المالية ============
  const filteredTransactions = useMemo(() => {
    if (!transactions.length) return [];

    const now = new Date();

    return transactions.filter((tx) => {
      if (filter === "all") return true;

      const txTime = new Date(tx.date).getTime();

      if (filter === "30days") {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        return txTime >= thirtyDaysAgo;
      }

      if (filter === "month") {
        const firstDayOfMonth = new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
        ).getTime();
        return txTime >= firstDayOfMonth;
      }

      if (filter === "custom") {
        const start = new Date(startDate).setHours(0, 0, 0, 0);
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        return txTime >= start && txTime <= end;
      }

      return true;
    });
  }, [transactions, filter, startDate, endDate]);

  // ============ حساب المبالغ والإحصائيات للفترة ============
  const periodStats = useMemo(() => {
    let periodDebit = 0;
    let periodCredit = 0;

    filteredTransactions.forEach((tx) => {
      periodDebit += Number(tx.debit || 0);
      periodCredit += Number(tx.credit || 0);
    });

    return {
      periodDebit,
      periodCredit,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // ============ استخراج الـ PDF للمشاريع ============
  const handleSharePdf = async () => {
    if (!customer) {
      notify.warning("بيانات العميل غير متوفرة حالياً");
      return;
    }

    try {
      setIsExportingPdf(true);

      let periodLabel = "كامل الحركات المسجلة";

      if (filter === "30days") {
        periodLabel = "حركات آخر 30 يوماً";
      } else if (filter === "month") {
        periodLabel = "حركات الشهر الحالي";
      } else if (filter === "custom") {
        const fromStr = startDate.toLocaleDateString("ar-EG");
        const toStr = endDate.toLocaleDateString("ar-EG");
        periodLabel = `الفترة من ${fromStr} إلى ${toStr}`;
      }

      await customerPdfService.shareLedgerPdf(
        customer,
        filteredTransactions,
        outstandingBalance,
        periodLabel,
      );
      notify.success("تم استخراج كشف الحساب بنجاح");
    } catch (error) {
      console.error("[CustomerLedgerScreen] PDF Export Error:", error);
      notify.error("فشل في استخراج كشف حساب الـ PDF");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ============ معالج اختيار التاريخ ============
  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowPicker(null);
    }

    if (event.type === "set" && selectedDate) {
      if (showPicker === "start") {
        selectedDate.setHours(0, 0, 0, 0);
        setStartDate(selectedDate);
      } else if (showPicker === "end") {
        selectedDate.setHours(23, 59, 59, 999);
        setEndDate(selectedDate);
      }
    }
  };

  // ============ رسم عنصر الحركة المالية ============
  const renderTransactionItem = useCallback(
    ({ item }: { item: LedgerTransactionItem }) => {
      const isInvoice =
        item.type === "invoice" || (item.debit && item.debit > 0);
      const debitVal = Number(item.debit || 0);
      const creditVal = Number(item.credit || 0);
      const runningBalanceVal = Number(item.runningBalance || 0);

      return (
        <Surface style={styles.transactionCard} elevation={0}>
          {/* رأس الحركة: النوع + التاريخ */}
          <View style={styles.txHeader}>
            <View style={styles.typeTag}>
              <View
                style={[
                  styles.iconDot,
                  {
                    backgroundColor: isInvoice
                      ? Colors.errorBg
                      : Colors.successBg,
                  },
                ]}
              >
                <AppIcon
                  name={isInvoice ? "receipt" : "check-circle"}
                  size={14}
                  color={isInvoice ? Colors.creditRed : Colors.paymentGreen}
                />
              </View>
              <Text
                style={[
                  styles.typeText,
                  { color: isInvoice ? Colors.creditRed : Colors.paymentGreen },
                ]}
              >
                {isInvoice ? "فاتورة / آجل" : "سند قبض / سداد"}
              </Text>
            </View>

            <Text style={styles.dateText}>{formatDateTime(item.date)}</Text>
          </View>

          {/* تفاصيل البيان */}
          <Text style={styles.descriptionText} numberOfLines={2}>
            {item.description ||
              (isInvoice ? "فاتورة مبيعات آفرة" : "سند قبض نقد")}
          </Text>

          {/* الأرقام المالية: مدين / دائن / الرصيد التراكمي */}
          <View style={styles.txFinancialsRow}>
            <View style={styles.finCol}>
              <Text style={styles.finLabel}>مدين (عليك)</Text>
              <Text
                style={[
                  styles.finValue,
                  {
                    color: debitVal > 0 ? Colors.creditRed : Colors.neutralText,
                    writingDirection: "ltr",
                  },
                ]}
              >
                {debitVal > 0
                  ? debitVal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })
                  : "-"}
              </Text>
            </View>

            <View style={styles.finCol}>
              <Text style={styles.finLabel}>دائن (لك)</Text>
              <Text
                style={[
                  styles.finValue,
                  {
                    color:
                      creditVal > 0 ? Colors.paymentGreen : Colors.neutralText,
                    writingDirection: "ltr",
                  },
                ]}
              >
                {creditVal > 0
                  ? creditVal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })
                  : "-"}
              </Text>
            </View>

            <View style={[styles.finCol, styles.finColEnd]}>
              <Text style={styles.finLabel}>الرصيد المتبقي</Text>
              <Text
                style={[
                  styles.runningValue,
                  { color: Colors.onSurface, writingDirection: "ltr" },
                ]}
              >
                {runningBalanceVal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
          </View>
        </Surface>
      );
    },
    [],
  );

  if (isCustomerLoading || isLedgerLoading) {
    return <LoadingOverlay visible />;
  }

  const isDebt = outstandingBalance > 0;
  const isCredit = outstandingBalance < 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors.background }]}
      edges={["top"]}
    >
      {/* الترويسة العليا */}
      <AppHeader
        title={`كشف حساب: ${customer?.name || "..."}`}
        showBack
        onBack={() => navigation.goBack()}
        actions={[
          {
            icon: isExportingPdf ? "refresh-cw" : "file-pdf-box",
            onPress: handleSharePdf,
          },
        ]}
      />

      <View style={styles.mainWrapper}>
        <FlashList
          data={filteredTransactions}
          renderItem={renderTransactionItem}
          keyExtractor={(item: LedgerTransactionItem, index: number) =>
            item.id || `ledger-tx-${index}`
          }
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              {/* 1. بطاقة الرصيد الإجمالي الحالية */}
              <Surface style={styles.balanceSummaryCard} elevation={0}>
                <Text style={styles.balanceSummaryTitle}>
                  الرصيد النهائي المستحق
                </Text>

                <View style={styles.amountBadgeRow}>
                  <CurrencyText
                    amount={Math.abs(outstandingBalance)}
                    variant="headlineMedium"
                    color={
                      isDebt
                        ? Colors.creditRed
                        : isCredit
                        ? Colors.paymentGreen
                        : Colors.onSurface
                    }
                  />
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isDebt
                        ? Colors.errorBg
                        : isCredit
                        ? Colors.successBg
                        : Colors.surfaceVariant,
                      borderColor: isDebt
                        ? Colors.errorLight
                        : isCredit
                        ? Colors.successLight
                        : Colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color: isDebt
                          ? Colors.creditRed
                          : isCredit
                          ? Colors.paymentGreen
                          : Colors.neutralText,
                      },
                    ]}
                  >
                    {isDebt
                      ? "مستحق على العميل (دين)"
                      : isCredit
                      ? "رصيد لصالح العميل (مقدم)"
                      : "الحساب متوازن بالكامل"}
                  </Text>
                </View>

                {/* ملخص الحركة للفترة المختارة */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>مجموع الفواتير (مدين)</Text>
                    <Text
                      style={[
                        styles.statValue,
                        { color: Colors.creditRed, writingDirection: "ltr" },
                      ]}
                    >
                      {periodStats.periodDebit.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>مجموع المقبوضات (دائن)</Text>
                    <Text
                      style={[
                        styles.statValue,
                        { color: Colors.paymentGreen, writingDirection: "ltr" },
                      ]}
                    >
                      {periodStats.periodCredit.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>عدد الحركات</Text>
                    <Text
                      style={[styles.statValue, { color: Colors.onSurface }]}
                    >
                      {periodStats.count}
                    </Text>
                  </View>
                </View>
              </Surface>

              {/* 2. شريط الفلاتر الكبسولية للفترات */}
              <View style={styles.filterBar}>
                <Chip
                  selected={filter === "all"}
                  onPress={() => setFilter("all")}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        filter === "all"
                          ? Colors.primary
                          : Colors.surfaceVariant,
                    },
                  ]}
                  textStyle={{
                    color:
                      filter === "all" ? Colors.onPrimary : Colors.onSurface,
                    fontSize: 11.5,
                    fontWeight: "bold",
                  }}
                >
                  الكل
                </Chip>

                <Chip
                  selected={filter === "30days"}
                  onPress={() => setFilter("30days")}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        filter === "30days"
                          ? Colors.primary
                          : Colors.surfaceVariant,
                    },
                  ]}
                  textStyle={{
                    color:
                      filter === "30days" ? Colors.onPrimary : Colors.onSurface,
                    fontSize: 11.5,
                    fontWeight: "bold",
                  }}
                >
                  آخر 30 يوماً
                </Chip>

                <Chip
                  selected={filter === "month"}
                  onPress={() => setFilter("month")}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        filter === "month"
                          ? Colors.primary
                          : Colors.surfaceVariant,
                    },
                  ]}
                  textStyle={{
                    color:
                      filter === "month" ? Colors.onPrimary : Colors.onSurface,
                    fontSize: 11.5,
                    fontWeight: "bold",
                  }}
                >
                  هذا الشهر
                </Chip>

                <Chip
                  selected={filter === "custom"}
                  onPress={() => setFilter("custom")}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        filter === "custom"
                          ? Colors.primary
                          : Colors.surfaceVariant,
                    },
                  ]}
                  textStyle={{
                    color:
                      filter === "custom" ? Colors.onPrimary : Colors.onSurface,
                    fontSize: 11.5,
                    fontWeight: "bold",
                  }}
                >
                  فترة مخصصة
                </Chip>
              </View>

              {/* 3. منتقي التواريخ عند اختيار فترة مخصصة */}
              {filter === "custom" && (
                <View style={styles.customDateContainer}>
                  <Pressable
                    style={styles.dateSelectorBtn}
                    onPress={() => setShowPicker("start")}
                  >
                    <AppIcon
                      name="calendar"
                      size={14}
                      color={Colors.neutralText}
                    />
                    <Text style={styles.dateBtnLabel}>
                      من: {startDate.toLocaleDateString("ar-EG")}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.dateSelectorBtn}
                    onPress={() => setShowPicker("end")}
                  >
                    <AppIcon
                      name="calendar"
                      size={14}
                      color={Colors.neutralText}
                    />
                    <Text style={styles.dateBtnLabel}>
                      إلى: {endDate.toLocaleDateString("ar-EG")}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* منتقي التاريخ المدمج */}
              {showPicker && (
                <DateTimePicker
                  value={showPicker === "start" ? startDate : endDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                />
              )}

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>تفاصيل الحركات المالية</Text>
                <Text style={styles.sectionSub}>
                  ({filteredTransactions.length} حركة)
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt"
              title="لا توجد حركات مالية"
              subtitle="لم يتم تسجيل أي فواتير أو مقبوضات خلال الفترة المحددة"
            />
          }
        />
      </View>
    </SafeAreaView>
  );
};

export default CustomerLedgerScreen;

// ========================================
// 3. Stylesheet
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainWrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  headerSection: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  balanceSummaryCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  balanceSummaryTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.neutralText,
    marginBottom: 2,
  },
  amountBadgeRow: {
    marginVertical: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
    marginBottom: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 9.5,
    color: Colors.neutralText,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "bold",
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
  },
  filterBar: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  filterChip: {
    height: 30,
    borderRadius: 6,
  },
  customDateContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  dateSelectorBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  dateBtnLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: Colors.onSurface,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 6,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  sectionSub: {
    fontSize: 11,
    color: Colors.neutralText,
  },
  transactionCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginVertical: 4,
  },
  txHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  typeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  iconDot: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  typeText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 10.5,
    color: Colors.neutralText,
  },
  descriptionText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: Colors.onSurface,
    marginVertical: 4,
    textAlign: "right",
  },
  txFinancialsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceVariant,
  },
  finCol: {
    flex: 1,
    alignItems: "flex-start",
  },
  finColEnd: {
    alignItems: "flex-end",
  },
  finLabel: {
    fontSize: 9.5,
    color: Colors.neutralText,
    marginBottom: 1,
  },
  finValue: {
    fontSize: 11.5,
    fontWeight: "bold",
  },
  runningValue: {
    fontSize: 12,
    fontWeight: "bold",
  },
});
