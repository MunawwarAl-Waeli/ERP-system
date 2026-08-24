/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  Text,
  useTheme,
  Surface,
  Card,
  Divider,
  Button,
  Portal,
  Dialog,
  TextInput,
  FAB,
} from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { EmptyState } from "@shared/components/EmptyState";
import { DateRangePicker } from "@shared/components/DateRangePicker";
import { paperIcon } from "@shared/components/Icon";
import { expenseRepository } from "../repositories/expenseRepository";
import { formatDateTime } from "@shared/utils/date";
import { CURRENCY_SYMBOL } from "@core/constants";

export const ExpenseListScreen: React.FC<{ navigation: any }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("expenses");

  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // حالة حوار إضافة مصروف جديد
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState(
    "default_expense_account",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await expenseRepository.getExpenses(startDate, endDate);
      const summary = await expenseRepository.getExpensesSummary(
        startDate,
        endDate,
      );

      setExpenses(list);
      setTotalExpenses(summary.total);
    } catch (error) {
      console.log("Error loading expenses:", error);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateExpense = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {return;}

    try {
      setIsSubmitting(true);
      await expenseRepository.createExpense({
        expenseAccountId,
        amount: numAmount,
        description,
        referenceNumber,
        expenseDate: new Date(),
        createdBy: "admin",
      });

      setShowAddDialog(false);
      setAmount("");
      setDescription("");
      setReferenceNumber("");
      loadData();
    } catch (error) {
      console.log("Error creating expense:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderExpenseItem = ({ item }: { item: any }) => (
    <View
      style={[
        styles.rowContainer,
        { borderBottomColor: theme.colors.surfaceVariant },
      ]}
    >
      <View style={styles.rowHeader}>
        <StatusBadge label="مصروف نقدي/بنكي" variant="error" compact />
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {formatDateTime(item.expenseDate || item.createdAt)}
        </Text>
      </View>

      <Text variant="bodyMedium" style={styles.descriptionText}>
        {item.description || "بدون بيان"}{" "}
        {item.referenceNumber ? `(مرجع: ${item.referenceNumber})` : ""}
      </Text>

      <View style={styles.rowFinancials}>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          المبلغ المدفوع:
        </Text>
        <CurrencyText
          amount={item.amount}
          variant="titleMedium"
          color={theme.colors.error}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={t("expensesManagement") || "إدارة المصروفات اليومية"}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scrollView}>
        {/* بطاقة الملخص المالي الإجمالي */}
        <Card
          style={[styles.headerCard, { backgroundColor: theme.colors.surface }]}
          mode="elevated"
        >
          <Card.Content>
            <View style={styles.summaryContainer}>
              <View>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  إجمالي المصروفات للفترة
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  عدد الحركات: {expenses.length}
                </Text>
              </View>
              <CurrencyText
                amount={totalExpenses}
                variant="headlineSmall"
                color={theme.colors.error}
              />
            </View>
          </Card.Content>
        </Card>

        {/* شريط الفلاتر بالتاريخ */}
        <Surface style={styles.filterSurface} elevation={1}>
          <Text variant="titleSmall" style={styles.filterTitle}>
            تصفية المصروفات حسب الفترة
          </Text>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </Surface>

        {/* جدول المصروفات */}
        <Surface style={styles.tableSurface} elevation={1}>
          <Text variant="titleMedium" style={styles.tableTitle}>
            سجل المصروفات التشغيلية
          </Text>
          <Divider style={{ marginBottom: 8 }} />

          {expenses.length === 0 && !isLoading ? (
            <EmptyState
              icon="cash-remove"
              title="لا توجد مصروفات مسجلة"
              subtitle="لم يتم رصد أي مصروفات نقدية أو بنكية خلال الفترات المحددة."
            />
          ) : (
            <FlashList
              data={expenses}
              renderItem={renderExpenseItem}
              keyExtractor={(item) => item.id}
              estimatedItemSize={90}
              scrollEnabled={false}
            />
          )}
        </Surface>
      </ScrollView>

      {/* زر الإضافة العائم */}
      <FAB
        icon={paperIcon("plus")}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => setShowAddDialog(true)}
      />

      {/* حوار تسجيل مصروف جديد */}
      <Portal>
        <Dialog
          visible={showAddDialog}
          onDismiss={() => setShowAddDialog(false)}
        >
          <Dialog.Title>تسجيل مصروف تشغيلي جديد</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="المبلغ"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              mode="outlined"
              left={<TextInput.Affix text={CURRENCY_SYMBOL} />}
              style={styles.dialogInput}
            />
            <TextInput
              label="رقم المرجع / الفاتورة (اختياري)"
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="البيان / الوصف"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAddDialog(false)}>إلغاء</Button>
            <Button
              mode="contained"
              onPress={handleCreateExpense}
              disabled={!amount || parseFloat(amount) <= 0 || isSubmitting}
            >
              حفظ وتوليد القيد
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, padding: 16 },
  headerCard: { marginBottom: 16, borderRadius: 12 },
  summaryContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterSurface: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  filterTitle: {
    marginBottom: 8,
    fontWeight: "bold",
  },
  tableSurface: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 80,
  },
  tableTitle: {
    marginBottom: 12,
    fontWeight: "bold",
  },
  rowContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  descriptionText: {
    marginBottom: 8,
    fontWeight: "500",
  },
  rowFinancials: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.02)",
    padding: 8,
    borderRadius: 8,
  },
  dialogInput: {
    marginBottom: 12,
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
