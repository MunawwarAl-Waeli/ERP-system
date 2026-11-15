/* eslint-disable arrow-body-style */
/* eslint-disable no-nested-ternary */
import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { useTheme, Searchbar, IconButton } from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@shared/components/AppHeader";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { EmptyState } from "@shared/components/EmptyState";
import { AccountTreeNode } from "../components/AccountTreeNode";
import { AccountFormModal } from "../components/AccountFormModal";
import ChartOfAccount from "src/database/models/ChartOfAccount";
import { AccountFormData } from "../schema/accountingSchema";
import { useRootAccounts } from "../hooks/useAccountingData";
import { accountingRepository } from "../repositories/AccountingSettingRepository";
import { paperIcon } from "@shared/components/Icon";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const ChartOfAccountsScreen: React.FC<{
  navigation: NavigationProp;
}> = ({ navigation }) => {
  const theme = useTheme();
  const { t } = useTranslation("accounting");
  const insets = useSafeAreaInsets();

  const { accounts, isLoading, error, refresh } = useRootAccounts();

  const [searchQuery, setSearchQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountFormData | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);

  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) {
      return accounts;
    }
    const query = searchQuery.toLowerCase();
    return accounts.filter(
      (acc) =>
        acc.code.toString().includes(query) ||
        acc.name.toLowerCase().includes(query),
    );
  }, [accounts, searchQuery]);

  const parentOptions = useMemo(() => {
    return accounts
      .filter((acc) => acc.id !== editingAccount?.id)
      .map((acc) => ({
        label: `${acc.code} - ${acc.name}`,
        value: acc.id,
      }));
  }, [accounts, editingAccount?.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch (e) {
      console.error(e);
      Alert.alert(t("common.error"), t("accounting.refreshFailed"));
    } finally {
      setRefreshing(false);
    }
  }, [refresh, t]);

  const handleAddRoot = () => {
    setEditingAccount(null);
    setModalVisible(true);
  };

  const handleEdit = (account: ChartOfAccount) => {
    setEditingAccount({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      parentId: account.parentId ?? "",
      isCashAccount: account.isCashAccount,
    } as AccountFormData);
    setModalVisible(true);
  };

  const handleAddSub = (parent: ChartOfAccount) => {
    setEditingAccount({
      code: "",
      name: "",
      type: parent.type,
      parentId: parent.id,
      isCashAccount: false,
    } as AccountFormData);
    setModalVisible(true);
  };

  const handleSaveAccount = async (data: AccountFormData) => {
    try {
      if (data.id) {
        await accountingRepository.update(data.id, data);
      } else {
        await accountingRepository.create(data);
      }
      setModalVisible(false);
      setEditingAccount(null);
    } catch (err) {
      console.error("Account save error", err);
      Alert.alert(t("common.error"), t("accounting.saveAccountError"));
    }
  };

  const renderContent = () => {
    if (error) {
      return (
        <View style={styles.centerContainer}>
          <EmptyState
            icon="alert-circle"
            title={t("common.error")}
            subtitle={t("accounting.errorLoadingAccounts")}
            actionLabel={t("common.retry")}
            onAction={() => refresh()}
          />
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom + 24, 24) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* شريط البحث مع زر الإضافة العلوي */}
        <View style={styles.searchRow}>
          <Searchbar
            placeholder={t("searchAccounts")}
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon={paperIcon("search")}
            clearIcon={paperIcon("x")}
            style={[
              styles.searchbar,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant || "rgba(0,0,0,0.08)",
              },
            ]}
            inputStyle={styles.searchInputStyle}
            elevation={0}
          />

          <IconButton
            icon={paperIcon("plus")}
            mode="contained"
            containerColor={theme.colors.primary}
            iconColor={theme.colors.onPrimary}
            size={22}
            onPress={handleAddRoot}
            style={styles.addButton}
          />
        </View>

        {filteredAccounts.length === 0 && !isLoading ? (
          <View style={styles.emptyStateWrapper}>
            {searchQuery ? (
              <EmptyState
                icon="magnify"
                title={t("noSearchResults")}
                subtitle={t("noSearchResultsDescription")}
              />
            ) : (
              <EmptyState
                icon="file-document-outline"
                title={t("noAccountsFound")}
                subtitle={t("noAccountsDescription")}
                actionLabel={t("addAccount")}
                onAction={handleAddRoot}
              />
            )}
          </View>
        ) : (
          <View
            style={[
              styles.treeShadowWrapper,
              {
                shadowColor: theme.colors.shadow || "#000",
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <View
              style={[
                styles.treeInnerContainer,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              {filteredAccounts.map((account) => (
                <AccountTreeNode
                  key={account.id}
                  account={account}
                  onEdit={handleEdit}
                  onAddSub={handleAddSub}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={t("chartOfAccounts")}
        showBack
        onBack={() => navigation.goBack()}
      />

      {renderContent()}

      {isLoading && <LoadingOverlay visible />}

      <AccountFormModal
        visible={modalVisible}
        initialData={editingAccount}
        onDismiss={() => setModalVisible(false)}
        onSave={handleSaveAccount}
        parentAccounts={parentOptions}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  searchbar: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
  },
  searchInputStyle: {
    minHeight: 0,
    alignSelf: "center",
  },
  addButton: {
    margin: 0,
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  emptyStateWrapper: {
    flex: 1,
    justifyContent: "center",
    marginTop: 32,
  },
  treeShadowWrapper: {
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    borderRadius: 16,
  },
  treeInnerContainer: {
    borderRadius: 16,
    overflow: "hidden",
  },
});
