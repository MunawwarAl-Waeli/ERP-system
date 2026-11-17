import React from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { Text, Surface } from "react-native-paper";
import { AppIcon } from "src/shared/components/Icon";
import { formatDateTime } from "@shared/utils/date";
import {
  useCustomerLedger,
  LedgerTransactionItem,
} from "../hooks/useCustomerLedger";
import { Colors } from "src/core/theme/colors";

interface CreditLedgerProps {
  customerId: string;
}

export const CreditLedger: React.FC<CreditLedgerProps> = ({ customerId }) => {
  // الربط المباشر بـ Hook المراقبة الحي لضمان التحديث اللحظي عند إضافة أي دفعة
  const { transactions, isLoading } = useCustomerLedger(customerId);

  if (isLoading) {
    return (
      <ActivityIndicator
        style={{ marginVertical: 16 }}
        color={Colors.primary}
      />
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <AppIcon name="receipt" size={32} color={Colors.neutralText} />
        <Text style={styles.emptyText}>
          لا توجد حركات مالية مسجلة لهذا العميل
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {transactions.map((tx: LedgerTransactionItem) => {
        const isInvoice = tx.type === "invoice" || (tx.debit && tx.debit > 0);
        const amount = isInvoice ? tx.debit : tx.credit;
        const formattedAmount = Number(amount || 0).toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
        const formattedBalance = Number(tx.runningBalance || 0).toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          },
        );

        return (
          <Surface key={tx.id} style={styles.card} elevation={0}>
            <View style={styles.rowTop}>
              {/* شارة نوع الحركة (مدين / دائن) */}
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isInvoice
                      ? Colors.errorBg
                      : Colors.successBg,
                    borderColor: isInvoice
                      ? Colors.errorLight
                      : Colors.successLight,
                  },
                ]}
              >
                <AppIcon
                  name={isInvoice ? "receipt" : "check-circle"}
                  size={12}
                  color={isInvoice ? Colors.creditRed : Colors.paymentGreen}
                />
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: isInvoice ? Colors.creditRed : Colors.paymentGreen,
                    },
                  ]}
                >
                  {isInvoice ? "مدين (فاتورة)" : "دائن (سداد)"}
                </Text>
              </View>

              {/* المبلغ والعملة */}
              <Text
                style={[
                  styles.amountText,
                  {
                    color: isInvoice ? Colors.creditRed : Colors.paymentGreen,
                    writingDirection: "ltr",
                  },
                ]}
              >
                {formattedAmount} <Text style={styles.currency}>ر.ي</Text>
              </Text>
            </View>

            {/* تفاصيل البيان والتاريخ */}
            <View style={styles.rowMiddle}>
              <Text style={styles.descriptionText} numberOfLines={1}>
                {tx.description}
              </Text>
              <Text style={styles.dateText}>{formatDateTime(tx.date)}</Text>
            </View>

            {/* الرصيد التراكمي المتبقي بعد هذه الحركة */}
            <View style={styles.rowBottom}>
              <Text style={styles.balanceLabel}>الرصيد بعدها:</Text>
              <Text style={[styles.balanceValue, { writingDirection: "ltr" }]}>
                {formattedBalance} ر.ي
              </Text>
            </View>
          </Surface>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: "bold",
  },
  amountText: {
    fontSize: 13.5,
    fontWeight: "bold",
  },
  currency: {
    fontSize: 9.5,
  },
  rowMiddle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.onSurface,
    flex: 1,
    textAlign: "right",
    marginLeft: 8,
  },
  dateText: {
    fontSize: 10,
    color: Colors.neutralText,
  },
  rowBottom: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceVariant,
  },
  balanceLabel: {
    fontSize: 10,
    color: Colors.neutralText,
  },
  balanceValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: Colors.onSurface,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.neutralText,
  },
});
