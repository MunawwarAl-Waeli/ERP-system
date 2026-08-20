// components/PurchaseInvoiceCard.tsx
import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Text, useTheme, Surface } from "react-native-paper";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";

import { useTranslation } from "react-i18next";
import { PurchaseInvoiceStatus } from "../repositories/purchaseRepository";

interface PurchaseInvoiceCardProps {
  invoiceNumber: string;
  supplierName: string;
  date: string;
  total: number;
  status: PurchaseInvoiceStatus;
  onPress: () => void;
}

export const PurchaseInvoiceCard: React.FC<PurchaseInvoiceCardProps> = ({
  invoiceNumber,
  supplierName,
  date,
  total,
  status,
  onPress,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("purchases");

  const getStatusVariant = (): "info" | "success" | "error" | "warning" => {
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

  return (
    <Pressable onPress={onPress}>
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.topRow}>
          <Text variant="titleMedium" style={{ fontWeight: "600" }}>
            {invoiceNumber}
          </Text>
          <StatusBadge label={t(`status.${status}`)} variant={getStatusVariant()} />
        </View>

        <View style={styles.middleRow}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {supplierName}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {date}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("total")}
          </Text>
          <CurrencyText amount={total} variant="titleMedium" />
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
    padding: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  middleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});