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
import { accountingRepository } from "../repositories/AccountingSettingRepository";

// ØªØ¹Ø±ÙŠÙ Ù†ÙˆØ¹ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª (ÙŠØ¬Ø¨ Ø£Ù† ÙŠØªØ·Ø§Ø¨Ù‚ Ù…Ø¹ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª)
interface AccountingSettingsData {
  inventoryDefaultAccountId: string;
  salesDefaultAccountId: string;
  cogsDefaultAccountId: string;
  customersAccountId: string;
  suppliersAccountId: string;
  cashDefaultAccountId: string;
  bankDefaultAccountId: string;
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
  const [menuVisible, setMenuVisible] = useState<string | null>(null); // Ø§Ø³Ù… Ø§Ù„Ø­Ù‚Ù„ Ø§Ù„Ù…ÙØªÙˆØ­

  // Ø¯Ø§Ù„Ø© Ù„Ø­ÙØ¸ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª
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
      // ÙŠÙ…ÙƒÙ† Ø¥Ø¸Ù‡Ø§Ø± Snackbar Ø®Ø·Ø£
    } finally {
      setSaving(false);
    }
  };

  // ØªØ­Ø¯ÙŠØ« Ù‚ÙŠÙ…Ø© Ø­Ù‚Ù„ Ù…Ø¹ÙŠÙ†
  const updateSetting = useCallback(
    (field: keyof AccountingSettingsData, accountId: string) => {
      if (settings) {
        accountingRepository.updateSettings(field, accountId); // Ø£Ùˆ Ø·Ø±ÙŠÙ‚Ø© Ù…Ø¨Ø§Ø´Ø±Ø© Ù„ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø­Ù‚Ù„
        // Ù„Ù„ØªØ­Ø¯ÙŠØ« Ø§Ù„ÙÙˆØ±ÙŠ ÙÙŠ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© ÙŠÙ…ÙƒÙ† Ø§Ø³ØªØ®Ø¯Ø§Ù… state Ù…Ø­Ù„ÙŠ Ø£Ùˆ ØªØ­Ø¯ÙŠØ« Ø§Ù„ÙƒØ§Ø¦Ù†
        // Ù„ÙƒÙ†Ù†Ø§ Ù†Ø¹ØªÙ…Ø¯ Ø¹Ù„Ù‰ WatermelonDB Ø§Ù„ØªÙØ§Ø¹Ù„ÙŠØ› Ø¥Ø°Ø§ ÙƒØ§Ù† useAccountingSettings ØªÙØ§Ø¹Ù„ÙŠØ§Ù‹ ÙØ³ÙŠØªØ­Ø¯Ø« ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹
        // Ø¥Ø°Ø§ Ù„Ù… ÙŠÙƒÙ†ØŒ ÙŠÙ…ÙƒÙ†Ù†Ø§ Ø¹Ù…Ù„ setSettings({ ...settings, [field]: accountId })
      }
    },
    [settings],
  );

  // ÙˆØµÙ Ø§Ù„Ø­Ù‚Ù„
  const getAccountName = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc ? `${acc.code} - ${acc.name}` : t("selectAccount");
  };

  const fields: Array<{
    key: keyof AccountingSettingsData;
    title: string;
    icon: string;
  }> = [
    {
      key: "inventoryDefaultAccountId",
      title: "حساب المخزون الافتراضي",
      icon: "package-variant-closed",
    },
    {
      key: "salesDefaultAccountId",
      title: "حساب المبيعات الافتراضي",
      icon: "cash-register",
    },
    {
      key: "cogsDefaultAccountId",
      title: "حساب تكلفة المبيعات الافتراضي",
      icon: "calculator",
    },
    {
      key: "customersAccountId",
      title: "حساب العملاء",
      icon: "account-group",
    },
    {
      key: "suppliersAccountId",
      title: "حساب الموردين",
      icon: "truck-delivery",
    },
    {
      key: "cashDefaultAccountId",
      title: "حساب الصندوق الافتراضي",
      icon: "cash",
    },
    {
      key: "bankDefaultAccountId",
      title: "حساب البنك الافتراضي",
      icon: "bank",
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
          onAction={() => accountingRepository.getSettings()} // Ø¥Ø°Ø§ ÙˆÙØ¬Ø¯Øª Ø¯Ø§Ù„Ø© Ø¥Ø¹Ø§Ø¯Ø© ØªØ­Ù…ÙŠÙ„
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

