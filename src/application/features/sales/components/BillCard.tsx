// components/SalesInvoiceCard.tsx
import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Text, useTheme, Surface } from "react-native-paper";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { AppIcon } from "@shared/components/Icon";
import { formatDateTime } from "@shared/utils/date";
import { DocumentStatus, PaymentType } from "src/core/constants";



interface SalesInvoiceCardProps {
  invoiceNumber: string;
  total: number;
  paymentType: PaymentType;
  status: DocumentStatus;
  invoiceDate: Date | number;
  customerName?: string;
  onPress: () => void;
}

export const SalesInvoiceCard: React.FC<SalesInvoiceCardProps> = ({
  invoiceNumber,
  total,
  paymentType,
  status,
  invoiceDate,
  customerName,
  onPress,
}) => {
  const theme = useTheme();

  // ========== حالة الفاتورة ==========
  const getStatusVariant = (): "success" | "error" | "info" | "warning" => {
    switch (status) {
      case "posted":
        return "success";
      case "cancelled":
        return "error";
      case "draft":
        return "warning";
  
      default:
        return "info";
    }
  };

  const getStatusLabel = (): string => {
    switch (status) {
      case "draft":
        return "مسودة";
      case "posted":
        return "معتمدة";
      case "cancelled":
        return "ملغاة";
    
      default:
        return status;
    }
  };

  // ========== طريقة الدفع ==========
  const getPaymentIcon = (): string => {
    switch (paymentType) {
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
    switch (paymentType) {
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
    switch (paymentType) {
      case "cash":
        return "نقدي";
      case "credit":
        return "آجل";
      case "partial":
        return "جزئي";
      default:
        return paymentType;
    }
  };

  const isCancelled = status === "cancelled";
  const isDraft = status === "draft";

  // ========== تنسيق التاريخ ==========
  const formattedDate =
    typeof invoiceDate === "number"
      ? formatDateTime(invoiceDate)
      : invoiceDate.toLocaleDateString();

  return (
    <Pressable onPress={onPress}>
      <Surface
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
        elevation={1}
      >
        {/* شريط جانبي ملون */}
        <View
          style={[
            styles.accent,
            {
              backgroundColor: isCancelled
                ? theme.colors.error
                : isDraft
                ? theme.colors.error
                : getPaymentColor(),
            },
          ]}
        />

        <View style={styles.content}>
          {/* الصف العلوي: رقم الفاتورة + المبلغ */}
          <View style={styles.topRow}>
            <View style={styles.billInfo}>
              <Text
                variant="titleMedium"
                style={[
                  styles.billNumber,
                  {
                    color: isCancelled
                      ? theme.colors.onSurfaceVariant
                      : theme.colors.onSurface,
                  },
                ]}
              >
                #{invoiceNumber}
              </Text>
              {customerName ? (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {customerName}
                </Text>
              ) : null}
            </View>
            <CurrencyText
              amount={total}
              variant="titleMedium"
              color={
                isCancelled
                  ? theme.colors.onSurfaceVariant
                  : theme.colors.primary
              }
              style={styles.amount}
            />
          </View>

          {/* الصف السفلي: التاريخ + الشارات */}
          <View style={styles.bottomRow}>
            <View style={styles.dateRow}>
              <AppIcon
                name="history"
                size={14}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {formattedDate}
              </Text>
            </View>

            <View style={styles.badges}>
              {/* شارة طريقة الدفع */}
              <View
                style={[
                  styles.paymentBadge,
                  { backgroundColor: `${getPaymentColor()}1A` },
                ]}
              >
                <AppIcon
                  name={getPaymentIcon()}
                  size={12}
                  color={getPaymentColor()}
                />
                <Text
                  variant="labelSmall"
                  style={{
                    color: getPaymentColor(),
                    fontWeight: "700",
                  }}
                >
                  {getPaymentLabel()}
                </Text>
              </View>

              {/* شارة الحالة (تظهر فقط للملغاة أو المسودة) */}
              {(isCancelled || isDraft) && (
                <StatusBadge
                  label={getStatusLabel()}
                  variant={getStatusVariant()}
                  compact
                />
              )}

              {/* شارة مدفوعة / مدفوعة جزئياً */}
              {(status === "posted") && (
                <StatusBadge
                  label={getStatusLabel()}
                  variant="success"
                  compact
                />
              )}
            </View>
          </View>
        </View>

        {/* سهم للتنقل */}
        <View style={styles.chevron}>
          <AppIcon
            name="chevron-right"
            size={18}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
      </Surface>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: "row",
    overflow: "hidden",
  },
  accent: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  billInfo: {
    flex: 1,
    gap: 2,
  },
  billNumber: {
    fontWeight: "600",
  },
  amount: {
    fontWeight: "700",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badges: {
    flexDirection: "row",
    gap: 6,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  chevron: {
    justifyContent: "center",
    paddingRight: 8,
  },
});
