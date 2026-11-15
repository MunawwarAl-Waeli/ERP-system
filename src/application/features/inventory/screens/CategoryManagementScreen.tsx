/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Keyboard,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  useTheme,
  Surface,
  Button,
  Searchbar,
  FAB,
  Portal,
  Modal,
  TextInput,
  Menu,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { notify } from "@shared/notifications";
import { services } from "src/application/compositionRoot";
import { database, Category } from "src/database";
import { Q } from "@nozbe/watermelondb";
import { ACCOUNT_TYPES } from "@core/constants";
import { ChartOfAccountData } from "@core/types/accounting/chartOfAccount";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

const ICON_OPTIONS: Array<{ name: string; label: string }> = [
  { name: "folder", label: "عام" },
  { name: "coffee", label: "قهوة" },
  { name: "cookie", label: "بسكويت" },
  { name: "cup-water", label: "مشروبات" },
  { name: "grain", label: "حبوب" },
  { name: "peanut", label: "مكسرات" },
  { name: "cow", label: "ألبان" },
  { name: "bottle-tonic", label: "زيوت" },
  { name: "food-drumstick", label: "لحوم" },
  { name: "food-variant", label: "أطعمة" },
  { name: "cube-outline", label: "منتجات" },
  { name: "shopping-cart", label: "بقالة" },
];

// ─── تصفية ذكية للحسابات بالكلمات المفتاحية ───
const smartFilter = (
  accounts: ChartOfAccountData[],
  keywords: string[],
): ChartOfAccountData[] => {
  const matched = accounts.filter((a) => {
    const searchText = `${a.name} ${a.code}`.toLowerCase();
    return keywords.some((kw) => searchText.includes(kw.toLowerCase()));
  });
  // إذا لم نجد تطابق، نرجع كل الحسابات (حتى لا يحرم المستخدم من الخيارات)
  return matched.length > 0 ? matched : accounts;
};

// ─── Account Picker ───
const AccountPicker: React.FC<{
  label: string;
  value?: string | null;
  options: ChartOfAccountData[];
  placeholder: string;
  suggestedId?: string | null;
  onChange: (id: string | null) => void;
}> = ({ label, value, options, placeholder, suggestedId, onChange }) => {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        variant="labelMedium"
        style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}
      >
        {label}
      </Text>
      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchor={
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              setVisible(true);
            }}
          >
            <View
              style={[
                styles.pickerField,
                {
                  borderColor: selected
                    ? theme.colors.primary
                    : theme.colors.outlineVariant,
                  borderWidth: selected ? 1.5 : 1,
                },
              ]}
            >
              <Text
                style={{
                  flex: 1,
                  color: selected
                    ? theme.colors.onSurface
                    : theme.colors.onSurfaceVariant,
                  fontSize: 14,
                  textAlign: "right",
                }}
                numberOfLines={1}
              >
                {selected ? `${selected.name} (${selected.code})` : placeholder}
              </Text>
              <AppIcon
                name="chevron-down"
                size={18}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          </TouchableOpacity>
        }
        style={{ maxHeight: 400 }}
      >
        <ScrollView style={{ maxHeight: 400 }}>
          <Menu.Item
            onPress={() => {
              onChange(null);
              setVisible(false);
            }}
            title="بدون (وراثة من الإعدادات الافتراضية)"
          />
          {options.map((opt) => (
            <Menu.Item
              key={opt.id}
              onPress={() => {
                onChange(opt.id);
                setVisible(false);
              }}
              title={`${opt.name} (${opt.code})`}
              leadingIcon={
                opt.id === suggestedId
                  ? ({ size }) => (
                      <AppIcon
                        name="check-circle"
                        size={size}
                        color={theme.colors.primary}
                      />
                    )
                  : undefined
              }
              titleStyle={
                opt.id === value
                  ? { color: theme.colors.primary, fontWeight: "700" }
                  : undefined
              }
            />
          ))}
        </ScrollView>
      </Menu>
    </View>
  );
};

interface CategoryItemProps {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}

const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
  onEdit,
  onDelete,
}) => {
  const theme = useTheme();
  const iconName = category.icon || "folder";
  const iconMeta = ICON_OPTIONS.find((o) => o.name === iconName);

  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.cardContent}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <AppIcon name={iconName} size={22} color={theme.colors.primary} />
        </View>

        <View style={styles.infoSection}>
          <Text variant="titleMedium" style={styles.name}>
            {category.name}
          </Text>
          {iconMeta ? (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {iconMeta.label}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onEdit}
            style={styles.actionBtn}
            hitSlop={8}
          >
            <AppIcon name="pencil" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            style={styles.actionBtn}
            hitSlop={8}
          >
            <AppIcon name="delete" size={18} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </Surface>
  );
};

export const CategoryManagementScreen: React.FC<{
  navigation: NavigationProp;
}> = ({ navigation }) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("folder");
  const [inventoryAccountId, setInventoryAccountId] = useState<string | null>(
    null,
  );
  const [salesAccountId, setSalesAccountId] = useState<string | null>(null);
  const [cogsAccountId, setCogsAccountId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [postingAccounts, setPostingAccounts] = useState<ChartOfAccountData[]>(
    [],
  );

  const loadData = async () => {
    try {
      const [list, accounts] = await Promise.all([
        database
          .get<Category>("categories")
          .query(Q.sortBy("name", Q.asc))
          .fetch(),
        services.chartOfAccount.getPostingAccounts(),
      ]);
      setCategories(list);
      setPostingAccounts(accounts);
    } catch (error) {
      notify.error("فشل تحميل التصنيفات");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ✅ مراقبة الكيبورد (Android + iOS)
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const openCreateModal = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryIcon("folder");
    setInventoryAccountId(null);
    setSalesAccountId(null);
    setCogsAccountId(null);
    setModalVisible(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryIcon(category.icon || "folder");
    setInventoryAccountId(category.inventoryAccountId || null);
    setSalesAccountId(category.salesAccountId || null);
    setCogsAccountId(category.cogsAccountId || null);
    setModalVisible(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    Keyboard.dismiss();
    setModalVisible(false);
    setEditingCategory(null);
  };

  const handleSave = async () => {
    if (!categoryName.trim()) {
      notify.warning("اسم التصنيف مطلوب");
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    try {
      const existing = await database
        .get<Category>("categories")
        .query(Q.where("name", categoryName.trim()), Q.take(1))
        .fetch();

      if (
        existing.length > 0 &&
        (!editingCategory || existing[0].id !== editingCategory.id)
      ) {
        notify.warning("يوجد تصنيف بنفس الاسم مسبقاً");
        setIsSaving(false);
        return;
      }

      await database.write(async () => {
        if (editingCategory) {
          await editingCategory.update((cat) => {
            cat.name = categoryName.trim();
            cat.icon = categoryIcon;
            cat.inventoryAccountId = inventoryAccountId;
            cat.salesAccountId = salesAccountId;
            cat.cogsAccountId = cogsAccountId;
          });
          notify.success("تم تحديث التصنيف");
        } else {
          await database.get<Category>("categories").create((cat) => {
            cat.name = categoryName.trim();
            cat.icon = categoryIcon;
            cat.inventoryAccountId = inventoryAccountId;
            cat.salesAccountId = salesAccountId;
            cat.cogsAccountId = cogsAccountId;
          });
          notify.success("تم إضافة التصنيف");
        }
      });

      setModalVisible(false);
      setEditingCategory(null);
      await loadData();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "فشل حفظ التصنيف");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = async (category: Category) => {
    try {
      const usedIn = await database
        .get("products")
        .query(Q.where("category_id", category.id), Q.take(1))
        .fetch();

      if (usedIn.length > 0) {
        notify.error(
          `لا يمكن حذف "${category.name}" — مستخدم في منتجات. يمكنك تعديل اسمه بدلاً من ذلك.`,
        );
        return;
      }

      setDeleteTarget(category);
    } catch (error) {
      notify.error("فشل فحص استخدام التصنيف");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);

    try {
      await database.write(async () => {
        const cat = await database.get<Category>("categories").find(target.id);
        await cat.destroyPermanently();
      });
      notify.success(`تم حذف "${target.name}"`);
      await loadData();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "فشل حذف التصنيف");
    }
  };

  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  const isEditMode = editingCategory !== null;

  // ─── تصفية ذكية للحسابات ───
  const allAssetAccounts = postingAccounts.filter(
    (a) => a.type === ACCOUNT_TYPES.ASSET,
  );
  const allRevenueAccounts = postingAccounts.filter(
    (a) => a.type === ACCOUNT_TYPES.REVENUE,
  );
  const allExpenseAccounts = postingAccounts.filter(
    (a) => a.type === ACCOUNT_TYPES.EXPENSE,
  );

  // حسابات المخزون: نبحث عن كلمات "مخزون" أو "بضاعة"
  const inventorySuggestions = smartFilter(allAssetAccounts, [
    "مخزون",
    "بضاعة",
    "inventory",
  ]);
  const suggestedInventoryId = inventorySuggestions[0]?.id;

  // حسابات المبيعات: نبحث عن "مبيعات" أو "إيرادات"
  const salesSuggestions = smartFilter(allRevenueAccounts, [
    "مبيعات",
    "إيراد",
    "ايراد",
    "sales",
    "revenue",
  ]);
  const suggestedSalesId = salesSuggestions[0]?.id;

  // حسابات التكلفة: نبحث عن "تكلفة" أو "cogs"
  const cogsSuggestions = smartFilter(allExpenseAccounts, [
    "تكلفة",
    "cogs",
    "cost of goods",
  ]);
  const suggestedCogsId = cogsSuggestions[0]?.id;

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

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="بحث عن تصنيف..."
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
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <CategoryItem
            category={item}
            onEdit={() => openEditModal(item)}
            onDelete={() => handleDeleteRequest(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="folder"
            title="لا توجد تصنيفات"
            subtitle="اضغط على زر الإضافة لإنشاء تصنيف جديد."
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
            {
              backgroundColor: theme.colors.surface,
              marginBottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
              maxHeight: keyboardHeight > 0 ? "60%" : "85%",
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View
                style={[
                  styles.modalIconCircle,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <AppIcon
                  name={isEditMode ? "pencil" : "plus-circle"}
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <Text variant="titleLarge" style={styles.modalTitle}>
                {isEditMode ? "تعديل التصنيف" : "إضافة تصنيف جديد"}
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

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              label="اسم التصنيف"
              value={categoryName}
              onChangeText={setCategoryName}
              mode="outlined"
              style={styles.input}
              right={
                <TextInput.Icon
                  icon={({ size, color }) => (
                    <AppIcon name="tag" size={size} color={color} />
                  )}
                />
              }
              autoFocus={!isEditMode}
              placeholder="مثل: مشروبات، ألبان، مكسرات"
            />

            <Text
              variant="labelLarge"
              style={{
                color: theme.colors.onSurfaceVariant,
                marginTop: 8,
                marginBottom: 8,
              }}
            >
              اختر أيقونة
            </Text>

            <View style={styles.iconPicker}>
              {ICON_OPTIONS.map((opt) => {
                const isSelected = categoryIcon === opt.name;
                return (
                  <TouchableOpacity
                    key={opt.name}
                    onPress={() => setCategoryIcon(opt.name)}
                    style={[
                      styles.iconOption,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primaryContainer
                          : theme.colors.surfaceVariant,
                        borderColor: isSelected
                          ? theme.colors.primary
                          : "transparent",
                      },
                    ]}
                  >
                    <AppIcon
                      name={opt.name}
                      size={22}
                      color={
                        isSelected
                          ? theme.colors.primary
                          : theme.colors.onSurfaceVariant
                      }
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.accountsSection}>
              <Text
                variant="titleSmall"
                style={{
                  color: theme.colors.onSurface,
                  marginBottom: 4,
                  marginTop: 8,
                }}
              >
                الحسابات المحاسبية
              </Text>
              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginBottom: 12,
                }}
              >
                تُورَّث تلقائياً لجميع منتجات هذا التصنيف. الحساب المقترح
                مُعلَّم بـ✓
              </Text>

              <AccountPicker
                label="حساب المخزون"
                value={inventoryAccountId}
                options={inventorySuggestions}
                placeholder="اختر حساب المخزون (أصول)"
                suggestedId={suggestedInventoryId}
                onChange={setInventoryAccountId}
              />

              <AccountPicker
                label="حساب المبيعات"
                value={salesAccountId}
                options={salesSuggestions}
                placeholder="اختر حساب المبيعات (إيرادات)"
                suggestedId={suggestedSalesId}
                onChange={setSalesAccountId}
              />

              <AccountPicker
                label="حساب تكلفة المبيعات (COGS)"
                value={cogsAccountId}
                options={cogsSuggestions}
                placeholder="اختر حساب التكلفة (مصروفات)"
                suggestedId={suggestedCogsId}
                onChange={setCogsAccountId}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.footerBtn}
              disabled={!categoryName.trim() || isSaving}
              loading={isSaving}
            >
              {isEditMode ? "حفظ التعديلات" : "حفظ التصنيف"}
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
        </Modal>

        <ConfirmDialog
          visible={deleteTarget !== null}
          title="حذف التصنيف"
          message={
            deleteTarget
              ? `سيتم حذف التصنيف "${deleteTarget.name}" نهائياً. هل أنت متأكد؟`
              : ""
          }
          confirmLabel="حذف"
          cancelLabel="إلغاء"
          destructive
          onConfirm={handleDeleteConfirm}
          onDismiss={() => setDeleteTarget(null)}
        />
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

  card: { marginBottom: 10, borderRadius: 14, padding: 12 },
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
  infoSection: { flex: 1 },
  name: { fontWeight: "700" },
  actions: { flexDirection: "row", gap: 4 },
  actionBtn: { padding: 8, borderRadius: 8 },

  fab: {
    position: "absolute",
    margin: 16,
    left: 0,
    bottom: 0,
    borderRadius: 16,
  },

  // ✅ إصلاح المودال: maxHeight + flex
  modalContainer: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 0,
    overflow: "hidden",
    alignSelf: "center",
    width: "90%",
    maxWidth: 460,
    maxHeight: "90%",
    flexShrink: 1,
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
  modalTitle: { fontWeight: "700", fontSize: 17 },

  // ✅ flexShrink للسماح بالانكماش
  modalBody: {
    flexShrink: 1,
  },
  modalBodyContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
  },
  input: { marginBottom: 12, backgroundColor: "transparent" },

  iconPicker: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 4,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },

  accountsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },

  pickerField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },

  modalFooter: {
    flexDirection: "row",
    padding: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  footerBtn: { flex: 1, borderRadius: 10 },
});
