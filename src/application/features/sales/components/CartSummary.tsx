// components/CartSummary.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme, Divider } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { CurrencyText } from "@shared/components/CurrencyText";

interface CartSummaryProps {
  subtotal: number;
  discountTotal: number; // ✅ تم تغيير الاسم من discount إلى discountTotal
  grandTotal: number;
  itemCount: number;
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  subtotal,
  discountTotal,
  grandTotal,
  itemCount,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("billing");

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      <View style={styles.row}>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("subtotal")} ({t("itemCount", { count: itemCount })})
        </Text>
        <CurrencyText amount={subtotal} variant="bodyMedium" />
      </View>

      {discountTotal > 0 && (
        <View style={styles.row}>
          <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
            {t("discount")}
          </Text>
          <CurrencyText
            amount={-discountTotal}
            variant="bodyMedium"
            style={{ color: theme.colors.primary }}
          />
        </View>
      )}

      <Divider style={styles.divider} />

      <View style={styles.row}>
        <Text
          variant="titleLarge"
          style={{ color: theme.colors.onSurface, fontWeight: "700" }}
        >
          {t("grandTotal")}
        </Text>
        <CurrencyText amount={grandTotal} variant="titleLarge" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  divider: {
    marginVertical: 8,
  },
});
