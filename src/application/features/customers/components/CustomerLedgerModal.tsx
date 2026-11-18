import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Modal,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { Button, Text, Chip, ActivityIndicator } from "react-native-paper";
import Customer from "src/database/models/Customer";
import {
  getDetailedLedger,
  LedgerTransactionItem,
} from "../repositories/customerRepository";
import { customerPdfService } from "../services/customerPdfService";
import { AppIcon } from "src/shared/components/Icon";
import { notify } from "@shared/notifications";
import { Colors } from "src/core/theme/colors";

type PeriodPreset = "ALL" | "THIS_MONTH" | "THIS_YEAR";

interface CustomerLedgerModalProps {
  visible: boolean;
  onDismiss: () => void;
  customer: Customer | null;
  currentBalance?: number;
}

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({
  visible,
  onDismiss,
  customer,
  currentBalance = 0,
}) => {
  const [period, setPeriod] = useState<PeriodPreset>("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [ledgerItems, setLedgerItems] = useState<LedgerTransactionItem[]>([]);

  // حساب تواريخ التصفية حسب الفترات
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (period === "THIS_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      );
      return { startDate: start, endDate: end };
    }
    if (period === "THIS_YEAR") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      return { startDate: start, endDate: end };
    }
    return { startDate: undefined, endDate: undefined };
  }, [period]);

  // جلب حركات كشف الحساب للفترة المحددة
  const fetchLedgerData = useCallback(async () => {
    if (!customer?.id) return;
    setIsLoading(true);
    try {
      const items = await getDetailedLedger(customer.id, startDate, endDate);
      setLedgerItems(items);
    } catch (error) {
      console.error("[CustomerLedgerModal] Fetch error:", error);
      notify.error("حدث خطأ أثناء جلب حركة الحساب");
    } finally {
      setIsLoading(false);
    }
  }, [customer?.id, startDate, endDate]);

  useEffect(() => {
    if (visible && customer) {
      fetchLedgerData();
    }
  }, [visible, customer, fetchLedgerData]);

  // حساب ملخص الفترة (إجمالي المدين وإجمالي الدائن)
  const summary = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;

    ledgerItems.forEach((item) => {
      totalDebit += item.debit || 0;
      totalCredit += item.credit || 0;
    });

    const netPeriodBalance = totalDebit - totalCredit;

    return {
      totalDebit,
      totalCredit,
      netPeriodBalance,
      itemsCount: ledgerItems.length,
    };
  }, [ledgerItems]);

  // 1. إجراء مشاركة PDF
  const handleSharePdf = async () => {
    if (!customer) return;
    try {
      await customerPdfService.shareLedgerPdf(
        customer,
        ledgerItems,
        summary.netPeriodBalance,
      );
    } catch (e) {
      notify.error("فشل في مشاركة ملف PDF");
    }
  };

  // 2. إجراء طباعة PDF
  const handlePrintPdf = async () => {
    if (!customer) return;
    try {
      // إن كانت الخدمة تدعم الطباعة المباشرة عبر react-native-print
      //   if (customerPdfService.printLedgerPdf) {
      //     await customerPdfService.printLedgerPdf(
      //       customer,
      //       ledgerItems,
      //       summary.netPeriodBalance,
      //     );
      //   } else
      {
        // البديل: فتح مشاركة النظام وتحديد الطباعة
        await customerPdfService.shareLedgerPdf(
          customer,
          ledgerItems,
          summary.netPeriodBalance,
        );
      }
    } catch (e) {
      notify.error("فشل في بدء عملية الطباعة");
    }
  };

  // 3. إجراء مشاركة ملخص عبر الواتساب
  const handleWhatsappShare = async () => {
    if (!customer) return;

    const periodText =
      period === "THIS_MONTH"
        ? "عن هذا الشهر"
        : period === "THIS_YEAR"
        ? "عن هذه السنة"
        : "الشامل";

    const balanceStatus =
      summary.netPeriodBalance > 0
        ? `مستحق عليكم: ${summary.netPeriodBalance.toLocaleString("en-US")} ر.ي`
        : summary.netPeriodBalance < 0
        ? `رصيد لكم: ${Math.abs(summary.netPeriodBalance).toLocaleString(
            "en-US",
          )} ر.ي`
        : "الحساب متوازن (0 ر.ي)";

    const message =
      `*كشف حساب ${periodText}*\n` +
      `العميل: *${customer.name}*\n` +
      `عدد الحركات: ${summary.itemsCount}\n` +
      `إجمالي المبيعات (مدين): ${summary.totalDebit.toLocaleString(
        "en-US",
      )} ر.ي\n` +
      `إجمالي التحصيلات (دائن): ${summary.totalCredit.toLocaleString(
        "en-US",
      )} ر.ي\n` +
      `--------------------------------\n` +
      `*صافي الرصيد: ${balanceStatus}*\n`;

    const url = `https://wa.me/${customer.phone}?text=${encodeURIComponent(
      message,
    )}`;
    Linking.openURL(url).catch(() => {
      notify.error("تعذر فتح تطبيق واتساب");
    });
  };

  if (!visible || !customer) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* الترويسة */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>كشف حساب عميل</Text>

              <Text style={styles.subtitle}>{customer.name}</Text>
            </View>
            <Pressable onPress={onDismiss} style={styles.closeBtn}>
              <AppIcon name="close" size={18} color={Colors.neutralText} />
            </Pressable>
          </View>

          {/* خيارات تصفية الفترة */}
          <View style={styles.periodSection}>
            <Text style={styles.sectionLabel}>اختر الفترة الزمنية:</Text>
            <View style={styles.chipsRow}>
              <Chip
                selected={period === "ALL"}
                onPress={() => setPeriod("ALL")}
                style={[
                  styles.chip,
                  period === "ALL" && { backgroundColor: Colors.primary },
                ]}
                textStyle={{
                  color: period === "ALL" ? Colors.onPrimary : Colors.onSurface,
                  fontSize: 11.5,
                  fontWeight: "bold",
                }}
              >
                الكل
              </Chip>
              <Chip
                selected={period === "THIS_MONTH"}
                onPress={() => setPeriod("THIS_MONTH")}
                style={[
                  styles.chip,
                  period === "THIS_MONTH" && {
                    backgroundColor: Colors.primary,
                  },
                ]}
                textStyle={{
                  color:
                    period === "THIS_MONTH"
                      ? Colors.onPrimary
                      : Colors.onSurface,
                  fontSize: 11.5,
                  fontWeight: "bold",
                }}
              >
                هذا الشهر
              </Chip>
              <Chip
                selected={period === "THIS_YEAR"}
                onPress={() => setPeriod("THIS_YEAR")}
                style={[
                  styles.chip,
                  period === "THIS_YEAR" && { backgroundColor: Colors.primary },
                ]}
                textStyle={{
                  color:
                    period === "THIS_YEAR"
                      ? Colors.onPrimary
                      : Colors.onSurface,
                  fontSize: 11.5,
                  fontWeight: "bold",
                }}
              >
                هذه السنة
              </Chip>
            </View>
          </View>

          {/* معاينة ملخص الحركات للفترة المختارة */}
          {isLoading ? (
            <ActivityIndicator
              style={{ marginVertical: 24 }}
              color={Colors.primary}
            />
          ) : (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>عدد الحركات:</Text>
                <Text style={styles.summaryValue}>{summary.itemsCount}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>إجمالي المبيعات (مدين):</Text>
                <Text
                  style={[styles.summaryValue, { color: Colors.creditRed }]}
                >
                  {summary.totalDebit.toLocaleString("en-US")} ر.ي
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  إجمالي المقبوضات (دائن):
                </Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: Colors.paymentGreen || "#2E7D32" },
                  ]}
                >
                  {summary.totalCredit.toLocaleString("en-US")} ر.ي
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>صافي رصيد الفترة:</Text>
                <Text
                  style={[
                    styles.totalValue,
                    {
                      color:
                        summary.netPeriodBalance > 0
                          ? Colors.creditRed
                          : summary.netPeriodBalance < 0
                          ? Colors.paymentGreen || "#2E7D32"
                          : Colors.onSurface,
                    },
                  ]}
                >
                  {Math.abs(summary.netPeriodBalance).toLocaleString("en-US")}{" "}
                  ر.ي
                </Text>
              </View>
            </View>
          )}

          {/* أزرار الإجراءات والطباعة والمشاركة */}
          <View style={styles.actionsContainer}>
            <Button
              mode="contained-tonal"
              icon={({ size, color }) => (
                <AppIcon name="whatsapp" size={size} color={color} />
              )}
              onPress={handleWhatsappShare}
              style={styles.actionBtn}
              labelStyle={styles.btnLabel}
            >
              واتساب
            </Button>

            <Button
              mode="contained-tonal"
              icon={({ size, color }) => (
                <AppIcon name="printer" size={size} color={color} />
              )}
              onPress={handlePrintPdf}
              style={styles.actionBtn}
              labelStyle={styles.btnLabel}
            >
              طباعة
            </Button>

            <Button
              mode="contained"
              icon={({ size, color }) => (
                <AppIcon name="file-pdf-box" size={size} color={color} />
              )}
              onPress={handleSharePdf}
              buttonColor={Colors.primary}
              style={styles.actionBtn}
              labelStyle={styles.btnLabel}
            >
              مشاركة PDF
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  container: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.onSurface,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.neutralText,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: Colors.surfaceVariant,
  },
  periodSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: Colors.neutralText,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 6,
  },
  chip: {
    height: 30,
    borderRadius: 6,
  },
  summaryBox: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 3,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.neutralText,
  },
  summaryValue: {
    fontSize: 12.5,
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: Colors.onSurface,
  },
  totalValue: {
    fontSize: 13.5,
    fontWeight: "bold",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
  },
  btnLabel: {
    fontSize: 11.5,
    fontWeight: "bold",
  },
});
