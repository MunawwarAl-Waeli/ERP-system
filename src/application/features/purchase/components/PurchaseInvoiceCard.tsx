// components/PurchaseInvoiceCard.tsx
import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Text, useTheme, Surface } from "react-native-paper";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { useDatabase } from "@nozbe/watermelondb/hooks";
import Supplier from "src/database/models/Supplier";

import { useTranslation } from "react-i18next";
import { PurchaseInvoiceStatus } from "../repositories/PurchaseInvoiceRepository";

interface PurchaseInvoiceCardProps {
  invoiceNumber: string;
  supplierId?: string;
  date: string;
  total: number;
  status: PurchaseInvoiceStatus;
  onPress: () => void;
}

export const PurchaseInvoiceCard: React.FC<PurchaseInvoiceCardProps> = ({
  invoiceNumber,
  supplierId,
  date,
  total,
  status,
  onPress,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("purchases");
  const database = useDatabase();
  const [supplierName, setSupplierName] = useState(t("noSupplier"));

  useEffect(() => {
    if (!supplierId) {
      setSupplierName(t("noSupplier"));
      return;
    }
    const sub = database
      .get<Supplier>("suppliers")
      .findAndObserve(supplierId)
      .subscribe({
        next: (s) => setSupplierName(s.name),
        error: () => setSupplierName(t("noSupplier")),
      });
    return () => sub.unsubscribe();
  }, [supplierId, t]);

  const getStatusVariant = (): "info" | "success" | "error" | "warning" => {
    switch (status) {
      case "draft": return "warning";
      case "approved":
      case "posted": return "success";
      case "cancelled": return "error";
      default: return "info";
    }
  };

  return (
    <Pressable onPress={onPress}>
      <Surface
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
        elevation={1}
      >
        <View style={styles.topRow}>
          <Text variant="titleMedium" style={{ fontWeight: "600" }}>
            {invoiceNumber}
          </Text>
          <StatusBadge
            label={t(`status.${status}`)}
            variant={getStatusVariant()}
          />
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
  card: { marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 14 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  middleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
