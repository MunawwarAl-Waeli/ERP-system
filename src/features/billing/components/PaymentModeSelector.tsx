// components/PaymentModeSelector.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { SegmentedButtons } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { paperIcon } from "@shared/components/Icon";

type PaymentType = "cash" | "credit" | "partial";

interface PaymentModeSelectorProps {
  value: PaymentType;
  onChange: (mode: PaymentType) => void;
  showCredit?: boolean; // يتحكم في ظهور خيارات الائتمان (credit و partial)
}

export const PaymentModeSelector: React.FC<PaymentModeSelectorProps> = ({
  value,
  onChange,
  showCredit = true,
}) => {
  const { t } = useTranslation("billing");

  // الأزرار الأساسية (نقدي)
  const buttons = [
    {
      value: "cash",
      label: t("cash"),
      icon: paperIcon("cash"),
    },
  ];

  // إضافة خيارات الائتمان إذا كان مسموحاً
  if (showCredit) {
    buttons.push(
      {
        value: "credit",
        label: t("credit"),
        icon: paperIcon("account-clock"),
      },
      {
        value: "partial",
        label: t("partial"),
        icon: paperIcon("percent"),
      },
    );
  }

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={value}
        onValueChange={(val) => onChange(val as PaymentType)}
        buttons={buttons}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
