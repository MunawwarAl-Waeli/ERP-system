/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  useTheme,
  Text,
  List,
  Button,
  Divider,
  Snackbar,
  Menu,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppHeader } from "@shared/components/AppHeader";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { EmptyState } from "@shared/components/EmptyState";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { useAccountingSettings, useAccounts } from "../hooks/useAccountingData";
import { accountingRepository } from "../repositories/accountingRepository";

// تعريف نوع الإعدادات (يجب أن يتطابق مع قاعدة البيانات)
interface AccountingSettingsData {
  salesAccountId: string;
  inventoryAccountId: string;
  cogsAccountId: string;
  customersAccountId: string;
  suppliersAccountId: string;
  [key: string]: string;
}

interface AccountItem {
  id: string;
  code: string;
  name: string;
}

export const AccountingSettingsScreen: React.FC<{ navigation: any }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("accounting");

  const {
    settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useAccountingSettings();
  const { accounts, isLoading: accountsLoading } = useAccounts();

  const [saving, setSaving] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState<string | null>(null); // اسم الحقل المفتوح

  // دالة لحفظ الإعدادات
  const handleSave = async () => {
    if (!settings) {
      return;
    }
    setSaving(true);
    try {
      await accountingRepository.createSettings(settings);
      setSnackbarVisible(true);
    } catch (error) {
      console.error("Failed to save settings", error);
      // يمكن إظهار Snackbar خطأ
    } finally {
      setSaving(false);
    }
  };

  // تحديث قيمة حقل معين
  const updateSetting = useCallback(
    (field: keyof AccountingSettingsData, accountId: string) => {
      if (settings) {
        accountingRepository.updateSettings(field, accountId); // أو طريقة مباشرة لتحديث الحقل
        // للتحديث الفوري في الواجهة يمكن استخدام state محلي أو تحديث الكائن
        // لكننا نعتمد على WatermelonDB التفاعلي؛ إذا كان useAccountingSettings تفاعلياً فسيتحدث تلقائياً
        // إذا لم يكن، يمكننا عمل setSettings({ ...settings, [field]: accountId })
      }
    },
    [settings],
  );

  // وصف الحقل
  const getAccountName = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc ? `${acc.code} - ${acc.name}` : t("selectAccount");
  };

  const fields: Array<{
    key: keyof AccountingSettingsData;
    title: string;
    icon: string;
  }> = [
    { key: "salesAccountId", title: t("salesAccount"), icon: "cash-register" },
    {
      key: "inventoryAccountId",
      title: t("inventoryAccount"),
      icon: "package-variant-closed",
    },
    { key: "cogsAccountId", title: t("cogsAccount"), icon: "calculator" },
    {
      key: "customersAccountId",
      title: t("customersAccount"),
      icon: "account-group",
    },
    {
      key: "suppliersAccountId",
      title: t("suppliersAccount"),
      icon: "truck-delivery",
    },
  ];

  if (settingsLoading || accountsLoading) {
    return <LoadingOverlay visible />;
  }

  if (settingsError || !settings) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <AppHeader
          title={t("accountingSettings")}
          showBack
          onBack={() => navigation.goBack()}
        />
        <EmptyState
          icon="alert-circle"
          title={t("common.error")}
          subtitle={t("accounting.errorLoadingSettings")}
          actionLabel={t("common.retry")}
          onAction={() => accountingRepository.getSettings()} // إذا وُجدت دالة إعادة تحميل
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={t("accountingSettings")}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionHeader}>
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.primary, fontWeight: "700" }}
          >
            {t("defaultAccountSettings")}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("defaultAccountSettingsDesc")}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          {fields.map((field, index) => (
            <React.Fragment key={field.key}>
              <Menu
                visible={menuVisible === field.key}
                onDismiss={() => setMenuVisible(null)}
                anchor={
                  <List.Item
                    title={field.title}
                    description={getAccountName(settings[field.key])}
                    left={() => (
                      <AppIcon
                        name={field.icon}
                        size={24}
                        color={theme.colors.onSurfaceVariant}
                        style={{ marginLeft: 8 }}
                      />
                    )}
                    right={() => (
                      <AppIcon
                        name="chevron-right"
                        size={20}
                        color={theme.colors.onSurfaceVariant}
                      />
                    )}
                    onPress={() => setMenuVisible(field.key)}
                  />
                }
              >
                {accounts.length > 0 ? (
                  accounts.map((acc) => (
                    <Menu.Item
                      key={acc.id}
                      onPress={() => {
                        updateSetting(field.key, acc.id);
                        setMenuVisible(null);
                      }}
                      title={`${acc.code} - ${acc.name}`}
                    />
                  ))
                ) : (
                  <Menu.Item title={t("noAccountsFound")} disabled />
                )}
              </Menu>
              {index < fields.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </View>

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveBtn}
          contentStyle={{ paddingVertical: 6 }}
          icon={paperIcon("content-save")}
        >
          {t("saveSettings")}
        </Button>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {t("settingsSaved")}
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  sectionHeader: { marginBottom: 16 },
  card: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 1,
    marginBottom: 20,
  },
  saveBtn: { borderRadius: 8 },
});
