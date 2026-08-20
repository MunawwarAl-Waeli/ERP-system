// components/PurchaseInvoiceItem.tsx
import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Text, useTheme, IconButton } from "react-native-paper";
import { CurrencyText } from "@shared/components/CurrencyText";

interface PurchaseInvoiceItemProps {
  productName: string;
  unitName: string;
  quantity: number;
  unitCost: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
}

export const PurchaseInvoiceItem: React.FC<PurchaseInvoiceItemProps> = ({
  productName,
  unitName,
  quantity,
  unitCost,
  total,
  onEdit,
  onDelete,
}) => {
  const theme = useTheme();

  return (
    <Pressable onPress={onEdit}>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
        >
        <View style={styles.leftContent}>
          <Text variant="bodyMedium" style={{ fontWeight: "500" }}>
            {productName}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {quantity} × {unitName} × {unitCost} ={" "}
            <CurrencyText amount={total} />
          </Text>
        </View>
        <IconButton icon="delete" size={20} onPress={onDelete} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  leftContent: { flex: 1 },
});
