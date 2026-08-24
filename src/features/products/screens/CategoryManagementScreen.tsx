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
import { database, Category } from "@core/database";
import { Q } from "@nozbe/watermelondb";

export const CategoryManagementScreen: React.FC<{ navigation: any }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      const cats = await database
        .get<Category>("categories")
        .query(Q.sortBy("name", Q.asc))
        .fetch();
      setCategories(cats);
    } catch (error) {
      console.error("Failed to fetch categories", error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setCategoryName("");
    setModalVisible(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!categoryName.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال اسم التصنيف.");
      return;
    }

    setIsSubmitting(true);
    try {
      await database.write(async () => {
        const categoriesCollection = database.get<Category>("categories");
        if (editingCategory) {
          await editingCategory.update((cat) => {
            cat.name = categoryName.trim();
          });
        } else {
          await categoriesCollection.create((cat) => {
            cat.name = categoryName.trim();
            cat.icon = "folder";
          });
        }
      });
      setModalVisible(false);
      fetchCategories();
    } catch (error) {
      Alert.alert("خطأ", "فشل حفظ التصنيف.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (category: Category) => {
    Alert.alert(
      "تأكيد الحذف",
      `هل أنت متأكد من حذف التصنيف "${category.name}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            try {
              await database.write(async () => {
                await category.destroyPermanently();
              });
              fetchCategories();
            } catch (error) {
              Alert.alert("خطأ", "لا يمكن حذف التصنيف لارتباطه بمنتجات.");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title="إدارة التصنيفات"
        showBack
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            title="لا توجد تصنيفات"
            description="اضغط على زر الإضافة لإنشاء تصنيف جديد."
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
            {editingCategory ? "تعديل التصنيف" : "إضافة تصنيف جديد"}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="اسم التصنيف"
              value={categoryName}
              onChangeText={setCategoryName}
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
