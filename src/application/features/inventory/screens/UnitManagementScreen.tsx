/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
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
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { notify } from "@shared/notifications";
import { services } from "src/application/compositionRoot";
import { UnitData } from "@core/types/inventory/unit";
import { database } from "src/database";
import { Q } from "@nozbe/watermelondb";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

interface UnitItemProps {
  unit: UnitData;
  onEdit: () => void;
  onDelete: () => void;
}

const UnitItem: React.FC<UnitItemProps> = ({ unit, onEdit, onDelete }) => {
  const theme = useTheme();

  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.cardContent}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <AppIcon
            name="scale"
            size={22}
            color={theme.colors.primary}
          />
        </View>

        <View style={styles.infoSection}>
          <Text variant="titleMedium" style={styles.name}>
            {unit.name}
          </Text>
          <View style={styles.codeRow}>
            <AppIcon
              name="tag"
              size={12}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.onSurfaceVariant,
                marginRight: 4,
                textTransform: "uppercase",
              }}
            >
              {unit.code}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onEdit}
            style={styles.actionBtn}
            hitSlop={8}
          >
            <AppIcon
              name="pencil"
              size={18}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            style={styles.actionBtn}
            hitSlop={8}
          >
            <AppIcon
              name="delete"
              size={18}
              color={theme.colors.error}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Surface>
  );
};

export const UnitManagementScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [units, setUnits] = useState<UnitData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitData | null>(null);
  const [unitName, setUnitName] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<UnitData | null>(null);

  const loadUnits = async () => {
    try {
      const list = await services.unit.getAll();
      setUnits(list);
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "فشل تحميل الوحدات",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const filteredUnits = units.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.code.toLowerCase().includes(q)
    );
  });

  const openCreateModal = () => {
    setEditingUnit(null);
    setUnitName("");
    setUnitCode("");
    setModalVisible(true);
  };

  const openEditModal = (unit: UnitData) => {
    setEditingUnit(unit);
    setUnitName(unit.name);
    setUnitCode(unit.code);
    setModalVisible(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setModalVisible(false);
    setEditingUnit(null);
  };

  const handleSave = async () => {
    if (!unitName.trim()) {
      notify.warning("اسم الوحدة مطلوب");
      return;
    }
    if (!unitCode.trim()) {
      notify.warning("كود الوحدة مطلوب");
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    try {
      if (editingUnit) {
        await services.unit.update(editingUnit.id, {
          name: unitName.trim(),
          code: unitCode.trim().toLowerCase(),
        });
        notify.success("تم تحديث الوحدة");
      } else {
        await services.unit.create({
          name: unitName.trim(),
          code: unitCode.trim().toLowerCase(),
        });
        notify.success("تم إضافة الوحدة");
      }
      setModalVisible(false);
      setEditingUnit(null);
      await loadUnits();
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "فشل حفظ الوحدة",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = async (unit: UnitData) => {
    // فحص الاستخدام قبل طلب الحذف
    try {
      const usedIn = await database
        .get("product_units")
        .query(Q.where("unit_id", unit.id), Q.take(1))
        .fetch();

      if (usedIn.length > 0) {
        notify.error(
          `لا يمكن حذف "${unit.name}" — مستخدمة في منتجات. يمكنك تعديل اسمها بدلاً من ذلك.`,
        );
        return;
      }

      setDeleteTarget(unit);
    } catch (error) {
      notify.error("فشل فحص استخدام الوحدة");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);

    try {
      await database.write(async () => {
        const unit = await database.get("units").find(target.id);
        await unit.destroyPermanently();
      });
      notify.success(`تم حذف "${target.name}"`);
      await loadUnits();
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "فشل حذف الوحدة",
      );
    }
  };

  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  const isEditMode = editingUnit !== null;

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

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="بحث بالاسم أو الكود..."
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
        data={filteredUnits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <UnitItem
            unit={item}
            onEdit={() => openEditModal(item)}
            onDelete={() => handleDeleteRequest(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="scale"
            title="لا توجد وحدات"
            subtitle="اضغط على زر الإضافة لإنشاء وحدة قياس جديدة."
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
                  {isEditMode ? "تعديل الوحدة" : "إضافة وحدة جديدة"}
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
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                label="اسم الوحدة"
                value={unitName}
                onChangeText={setUnitName}
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
                placeholder="مثل: قطعة، كرتون، لتر"
              />
              <TextInput
                label="كود الوحدة"
                value={unitCode}
                onChangeText={setUnitCode}
                mode="outlined"
                style={styles.input}
                right={
                  <TextInput.Icon
                    icon={({ size, color }) => (
                      <AppIcon name="barcode" size={size} color={color} />
                    )}
                  />
                }
                autoCapitalize="none"
                placeholder="مثل: pcs, ctn, ltr"
              />
              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginBottom: 8,
                }}
              >
                الكود يُستخدم داخلياً لتمييز الوحدة. لا يمكن تغييره بعد الربط بمنتجات.
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.footerBtn}
                disabled={!unitName.trim() || !unitCode.trim() || isSaving}
                loading={isSaving}
              >
                {isEditMode ? "حفظ التعديلات" : "حفظ الوحدة"}
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

        <ConfirmDialog
          visible={deleteTarget !== null}
          title="حذف الوحدة"
          message={
            deleteTarget
              ? `سيتم حذف الوحدة "${deleteTarget.name}" نهائياً. هل أنت متأكد؟`
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
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 4,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
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
  modalTitle: { fontWeight: "700", fontSize: 17 },
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
