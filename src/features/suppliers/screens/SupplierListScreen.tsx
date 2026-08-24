import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { Text, useTheme, Card, Button, Searchbar, FAB, Portal, Dialog, TextInput } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { supplierRepository } from "../repositories/supplierRepository";
import Supplier from "@core/database/models/Supplier";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

const SupplierItem = ({ supplier, onPress }: { supplier: Supplier; onPress: () => void }) => {
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
        <View style={styles.infoSection}>
          <Text variant="titleMedium" style={{ fontWeight: "bold" }}>{supplier.name}</Text>
          {supplier.phone ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {supplier.phone}
            </Text>
          ) : null}
        </View>
        <View style={styles.balanceSection}>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>المستحق له</Text>
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

export const SupplierListScreen: React.FC<{ navigation: NavigationProp }> = ({ navigation }) => {
  const theme = useTheme();
  const { t } = useTranslation("suppliers");
  const [searchQuery, setSearchQuery] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Add Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

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
      (s.phone && s.phone.includes(searchQuery))
  );

  const handleAddSupplier = async () => {
    if (!newName.trim()) return;
    await supplierRepository.create({ name: newName.trim(), phone: newPhone.trim() });
    setModalVisible(false);
    setNewName("");
    setNewPhone("");
  };

  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <AppHeader title="إدارة الموردين" showBack onBack={() => navigation.goBack()} />

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="بحث عن مورد..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>

      <FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <SupplierItem
            supplier={item}
            onPress={() => navigation.navigate("SupplierLedger", { supplierId: item.id })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="truck-delivery-outline"
            title="لا يوجد موردين"
            subtitle="قم بإضافة موردين جدد لتسجيل فواتير الشراء وإدارة حساباتهم."
          />
        }
      />

      <FAB
        icon={paperIcon("plus")}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => setModalVisible(true)}
      />

      <Portal>
        <Dialog visible={modalVisible} onDismiss={() => setModalVisible(false)}>
          <Dialog.Title>إضافة مورد جديد</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="اسم المورد"
              value={newName}
              onChangeText={setNewName}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="رقم الهاتف"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setModalVisible(false)}>إلغاء</Button>
            <Button mode="contained" onPress={handleAddSupplier} disabled={!newName.trim()}>
              حفظ المورد
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { padding: 16, paddingBottom: 8 },
  searchBar: { elevation: 0, backgroundColor: "rgba(0,0,0,0.03)" },
  listContent: { padding: 16, paddingBottom: 80 },
  card: { marginBottom: 12, borderRadius: 12 },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoSection: { flex: 2 },
  balanceSection: { flex: 1, alignItems: "flex-end", marginRight: 12 },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  input: { marginBottom: 12 },
});
