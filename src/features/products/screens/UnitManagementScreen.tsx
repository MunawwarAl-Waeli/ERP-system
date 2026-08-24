/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Alert } from "react-native";
import {
  Text,
  useTheme,
  Surface,
  Button,
  IconButton,
  Portal,
  Dialog,
  TextInput,
  FAB,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { database, Unit } from "@core/database";
import { Q } from "@nozbe/watermelondb";

export const UnitManagementScreen: React.FC<{ navigation: any }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const [units, setUnits] = useState<Unit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitName, setUnitName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUnits = async () => {
    try {
      const allUnits = await database
        .get<Unit>("units")
        .query(Q.sortBy("name", Q.asc))
        .fetch();
      setUnits(allUnits);
    } catch (error) {
      console.error("Failed to fetch units", error);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleOpenAdd = () => {
    setEditingUnit(null);
    setUnitName("");
    setModalVisible(true);
  };

  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setUnitName(unit.name);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!unitName.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال اسم الوحدة.");
      return;
    }

    setIsSubmitting(true);
    try {
      await database.write(async () => {
        const unitsCollection = database.get<Unit>("units");
        if (editingUnit) {
          await editingUnit.updateUnit({ name: unitName.trim() });
        } else {
          await unitsCollection.create((u) => {
            u.name = unitName.trim();
          });
        }
      });
      setModalVisible(false);
      fetchUnits();
    } catch (error) {
      Alert.alert("خطأ", "فشل حفظ الوحدة.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (unit: Unit) => {
    Alert.alert("تأكيد الحذف", `هل أنت متأكد من حذف الوحدة "${unit.name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await database.write(async () => {
              await unit.destroyPermanently();
            });
            fetchUnits();
          } catch (error) {
            Alert.alert("خطأ", "لا يمكن حذف الوحدة لارتباطها بمنتجات.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title="إدارة وحدات القياس"
        showBack
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={units}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            title="لا توجد وحدات"
            description="اضغط على زر الإضافة لإنشاء وحدة قياس جديدة."
          />
        }
        renderItem={({ item }) => (
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardContent}>
              <Text
                variant="titleMedium"
                style={{ fontWeight: "bold", flex: 1 }}
              >
                {item.name}
              </Text>
              <IconButton
                icon="pencil"
                iconColor={theme.colors.primary}
                size={20}
                onPress={() => handleOpenEdit(item)}
              />
              <IconButton
                icon="delete"
                iconColor={theme.colors.error}
                size={20}
                onPress={() => handleDelete(item)}
              />
            </View>
          </Surface>
        )}
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="#fff"
        onPress={handleOpenAdd}
      />

      <Portal>
        <Dialog visible={modalVisible} onDismiss={() => setModalVisible(false)}>
          <Dialog.Title>
            {editingUnit ? "تعديل الوحدة" : "إضافة وحدة جديدة"}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="اسم الوحدة (مثل: قطعة، كرتون، لتر)"
              value={unitName}
              onChangeText={setUnitName}
              mode="outlined"
              style={{ marginTop: 8 }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setModalVisible(false)}>إلغاء</Button>
            <Button
              mode="contained"
              onPress={handleSave}
              loading={isSubmitting}
            >
              حفظ
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: { padding: 16, paddingBottom: 80 },
  card: { padding: 12, borderRadius: 8, marginBottom: 12 },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fab: { position: "absolute", margin: 16, right: 0, bottom: 0 },
});
