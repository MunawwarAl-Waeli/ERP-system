import React, { useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import {
  Portal,
  Dialog,
  TextInput,
  Button,
  Text,
  Chip,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { AppIcon } from "src/shared/components/Icon";
import { Colors } from "src/core/theme/colors";

interface PaymentDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (amount: number, notes: string) => Promise<void>;
  maxAmount: number;
  isLoading?: boolean;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  visible,
  onDismiss,
  onSubmit,
  maxAmount,
  isLoading = false,
}) => {
  const { t } = useTranslation("customers");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // إعادة ضبط المدخلات عند فتح النافذة
  useEffect(() => {
    if (visible) {
      setAmount("");
      setNotes("");
      setError(null);
    }
  }, [visible]);

  const handleSetFullAmount = () => {
    if (maxAmount > 0) {
      setAmount(maxAmount.toString());
      setError(null);
    }
  };

  const handleSubmit = async () => {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("يرجى إدخال مبلغ صحيح أكبر من الصفر");
      return;
    }

    setError(null);
    await onSubmit(numAmount, notes.trim());
  };

  const formattedMaxAmount = Math.max(0, maxAmount).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={styles.dialog}
        dismissable={!isLoading}
      >
        <Dialog.Title style={styles.title}>تحصيل دفعة مالية</Dialog.Title>

        <Dialog.Content style={styles.content}>
          {/* إجمالي المديونية الحالية */}
          <View style={styles.debtBox}>
            <Text style={styles.debtLabel}>إجمالي المديونية الحالية:</Text>
            <Text style={styles.debtValue}>
              {formattedMaxAmount} <Text style={styles.currency}>ر.ي</Text>
            </Text>
          </View>

          {/* حقل إدخال المبلغ */}
          <TextInput
            label="المبلغ المحصل (ر.ي)"
            value={amount}
            onChangeText={(text) => {
              setAmount(text);
              if (error) setError(null);
            }}
            keyboardType="numeric"
            mode="outlined"
            outlineColor={error ? Colors.creditRed : Colors.border}
            activeOutlineColor={Colors.primary}
            style={styles.input}
            error={!!error}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* زر التعبئة السريعة لسداد كامل المبلغ */}
          {maxAmount > 0 && (
            <View style={styles.quickChipRow}>
              <Chip
                compact
                mode="outlined"
                onPress={handleSetFullAmount}
                icon={() => (
                  <AppIcon
                    name="check-circle"
                    size={13}
                    color={Colors.primary}
                  />
                )}
                style={styles.chip}
                textStyle={styles.chipText}
              >
                سداد كامل المبلغ ({formattedMaxAmount} ر.ي)
              </Chip>
            </View>
          )}

          {/* حقل الملاحظات */}
          <TextInput
            label="ملاحظات / رقم السند (اختياري)"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            style={styles.input}
          />
        </Dialog.Content>

        <Dialog.Actions style={styles.actions}>
          <Button
            onPress={onDismiss}
            disabled={isLoading}
            textColor={Colors.neutralText}
          >
            إلغاء
          </Button>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
            buttonColor={Colors.primary}
            style={styles.submitBtn}
            labelStyle={styles.submitBtnLabel}
          >
            تسجيل الدفعة
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.onSurface,
    textAlign: "right",
  },
  content: {
    paddingTop: 0,
  },
  debtBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  debtLabel: {
    fontSize: 11.5,
    color: Colors.neutralText,
  },
  debtValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.creditRed,
    writingDirection: "ltr",
  },
  currency: {
    fontSize: 10,
  },
  input: {
    marginBottom: 8,
    backgroundColor: Colors.surface,
    fontSize: 13,
  },
  errorText: {
    fontSize: 11,
    color: Colors.creditRed,
    marginBottom: 6,
  },
  quickChipRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  chip: {
    backgroundColor: Colors.surfaceVariant,
    borderColor: Colors.border,
  },
  chipText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "600",
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  submitBtn: {
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  submitBtnLabel: {
    fontSize: 13,
    fontWeight: "bold",
  },
});
