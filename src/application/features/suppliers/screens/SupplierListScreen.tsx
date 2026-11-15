import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import {
  Text,
  useTheme,
  Card,
  Button,
  Searchbar,
  FAB,
  Portal,
  Modal,
  TextInput,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { supplierRepository } from "../repositories/supplierRepository";
import Supplier from "src/database/models/Supplier";
import { services } from "src/application/compositionRoot";
import { notify } from "@shared/notifications";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

const SupplierItem = ({
  supplier,
  onPress,
}: {
  supplier: Supplier;
  onPress: () => void;
}) => {
  const theme = useTheme();
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const fetchBalance = async () => {
      const b = await supplierRepository.getOutstandingBalance(supplier.id);
      setBalance(b);
    };
    fetchBalance();
  }, [supplier.id]);

  return (
    <Card style={styles.card} onPress={onPress} mode="outlined">
      <Card.Content style={styles.cardContent}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <AppIcon
            name="truck-delivery"
            size={22}
            color={theme.colors.primary}
          />
        </View>

        <View style={styles.infoSection}>
          <Text variant="titleMedium" style={styles.name}>
            {supplier.name}
          </Text>
          {supplier.phone ? (
            <View style={styles.phoneRow}>
              <AppIcon
                name="phone"
                size={13}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginRight: 4,
                }}
              >
                {supplier.phone}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.balanceSection}>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            المستحق له
          </Text>
          <CurrencyText
            amount={Math.abs(balance)}
            variant="titleMedium"
            color={balance > 0 ? theme.colors.error : theme.colors.primary}
          />
        </View>

        <AppIcon name="chevron-left" size={20} color={theme.colors.outline} />
      </Card.Content>
    </Card>
  );
};

export const SupplierListScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("suppliers");
  const [searchQuery, setSearchQuery] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const subscription = supplierRepository.observeAll().subscribe((list) => {
      if (isMounted) {
        setSuppliers(list);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery)),
  );

  const openCreateModal = () => {
    setNewName("");
    setNewPhone("");
    setModalVisible(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setModalVisible(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      notify.warning("اسم المورد مطلوب");
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    try {
      await services.supplier.create({
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        address: undefined,
      });
      notify.success("تم إضافة المورد بنجاح");
      setModalVisible(false);
      setNewName("");
      setNewPhone("");
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "فشل حفظ المورد",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title="إدارة الموردين"
        showBack
        onBack={() => navigation.goBack()}
      />

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="بحث عن مورد..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          icon={() => (
            <AppIcon
              name="magnify"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          )}
          clearIcon={() => (
            <AppIcon
              name="close"
              size={18}
              color={theme.colors.onSurfaceVariant}
            />
          )}
        />
      </View>

      <FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <SupplierItem
            supplier={item}
            onPress={() =>
              navigation.navigate("SupplierLedger", { supplierId: item.id })
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="truck-delivery"
            title="لا يوجد موردين"
            subtitle="قم بإضافة موردين جدد لتسجيل فواتير الشراء وإدارة حساباتهم."
          />
        }
      />

      <FAB
        icon={paperIcon("plus")}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={openCreateModal}
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={closeModal}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
          style={{ width: "100%" }}
          >
            {/* Header: [Icon + Title] on the right, [X] on the left */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View
                  style={[
                    styles.modalIconCircle,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <AppIcon
                    name="account-plus"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <Text variant="titleLarge" style={styles.modalTitle}>
                  إضافة مورد جديد
                </Text>
              </View>
              <Button
                compact
                onPress={closeModal}
                icon={() => (
                  <AppIcon
                    name="close"
                    size={22}
                    color={theme.colors.onSurfaceVariant}
                  />
                )}
              />
            </View>

            {/* Body — Scrollable to stay above keyboard */}
            <ScrollView
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                label="اسم المورد"
                value={newName}
                onChangeText={setNewName}
                mode="outlined"
                style={styles.input}
                right={
                  <TextInput.Icon
                    icon={({ size, color }) => (
                      <AppIcon name="user" size={size} color={color} />
                    )}
                  />
                }
                autoFocus
              />
              <TextInput
                label="رقم الهاتف (اختياري)"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
                mode="outlined"
                style={styles.input}
                right={
                  <TextInput.Icon
                    icon={({ size, color }) => (
                      <AppIcon name="phone" size={size} color={color} />
                    )}
                  />
                }
              />
            </ScrollView>

            {/* Footer: [Save] on the right (primary), [Cancel] on the left */}
            <View style={styles.modalFooter}>
              <Button
                mode="contained"
                onPress={handleCreate}
                style={styles.footerBtn}
                disabled={!newName.trim() || isSaving}
                loading={isSaving}
              >
                حفظ المورد
              </Button>
              <Button
                mode="outlined"
                onPress={closeModal}
                style={styles.footerBtn}
                disabled={isSaving}
              >
                إلغاء
              </Button>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchBar: {
    elevation: 0,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  searchInput: { textAlign: "right", fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 90 },
  card: { marginBottom: 10, borderRadius: 14 },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  infoSection: {
    flex: 1,
    alignItems: "flex-start",
  },
  name: {
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  balanceSection: {
    alignItems: "flex-end",
  },
  fab: {
    position: "absolute",
    margin: 16,
    left: 0,
    bottom: 0,
    borderRadius: 16,
  },

  // Modal
  modalContainer: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 0,
    overflow: "hidden",
    alignSelf: "center",
    width: "90%",
    maxWidth: 460,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontWeight: "700",
    fontSize: 17,
  },
  modalBody: {
    paddingHorizontal: 18,
    paddingTop: 16,
    flexShrink: 1,
  },
  input: { marginBottom: 12, backgroundColor: "transparent" },
  modalFooter: {
    flexDirection: "row",
    padding: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  footerBtn: { flex: 1, borderRadius: 10 },
});
