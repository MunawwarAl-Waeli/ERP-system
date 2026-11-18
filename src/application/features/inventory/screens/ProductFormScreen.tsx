/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  useTheme,
  TextInput,
  Button,
  Switch,
  Divider,
  Surface,
  Menu,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { AppIcon } from "@shared/components/Icon";
import { notify } from "@shared/notifications";
import { services } from "src/application/compositionRoot";
import { UNIT_CODES, ACCOUNT_TYPES } from "@core/constants";
import { database } from "src/database";
import Category from "src/database/models/Category";
import { Q } from "@nozbe/watermelondb";
import { UnitData } from "@core/types/inventory/unit";
import { ChartOfAccountData } from "@core/types/accounting/chartOfAccount";
import {
  CreateProductInput,
  ProductData,
  ProductUnitData,
} from "@core/types/products/product";
import { BarcodeScannerModal } from "../../purchase/components/BarcodeScannerModal";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

interface RouteProp {
  params?: { productId?: string };
}

interface AdditionalUnit {
  tempId: string;
  id?: string;
  unitId: string;
  unitName?: string;
  conversionFactor: string;
  salePrice: string;
  purchasePrice: string;
  barcode: string;
}

// ─── Picker helper ─────────────────────────────────────────
interface PickerOption {
  id: string;
  label: string;
  sublabel?: string;
}

const Picker: React.FC<{
  label: string;
  value: string | undefined;
  options: PickerOption[];
  placeholder: string;
  onChange: (id: string) => void;
}> = ({ label, value, options, placeholder, onChange }) => {
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
          <TouchableOpacity onPress={() => setVisible(true)}>
            <View
              style={[
                styles.pickerField,
                { borderColor: theme.colors.outlineVariant },
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
                {selected ? selected.label : placeholder}
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
          {options.length === 0 ? (
            <Menu.Item title="لا توجد خيارات متاحة" disabled />
          ) : (
            options.map((opt) => (
              <Menu.Item
                key={opt.id}
                onPress={() => {
                  onChange(opt.id);
                  setVisible(false);
                }}
                title={
                  opt.sublabel ? `${opt.label} — ${opt.sublabel}` : opt.label
                }
                titleStyle={
                  opt.id === value
                    ? { color: theme.colors.primary, fontWeight: "700" }
                    : undefined
                }
              />
            ))
          )}
        </ScrollView>
      </Menu>
    </View>
  );
};

// ─── Main Screen ───────────────────────────────────────────
export const ProductFormScreen: React.FC<{
  navigation: NavigationProp;
  route: RouteProp;
}> = ({ navigation, route }) => {
  const theme = useTheme();
  const editingId = route.params?.productId;
  const isEditMode = !!editingId;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [minStock, setMinStock] = useState("0");
  const [isActive, setIsActive] = useState(true);

  // Units
  const [pieceUnitMeta, setPieceUnitMeta] = useState<UnitData | null>(null);
  const [allUnits, setAllUnits] = useState<UnitData[]>([]);
  const [pieceUnitData, setPieceUnitData] = useState<{
    id?: string;
    salePrice: string;
    purchasePrice: string;
    barcode: string;
  }>({ salePrice: "", purchasePrice: "", barcode: "" });
  const [additionalUnits, setAdditionalUnits] = useState<AdditionalUnit[]>([]);

  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [postingAccounts, setPostingAccounts] = useState<ChartOfAccountData[]>(
    [],
  );

  // 2. أضف هذه الحالات داخل المكون (تحت الحالات الأخرى)
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<string | null>(null);
  // null = مغلق، "base" = القطعة الأساسية، tempId = وحدة إضافية
  // ─── Load initial data ───────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Load units + ensure piece unit exists
      let unitsList = await services.unit.getAll();
      let pieceUnit = unitsList.find((u) => u.code === UNIT_CODES.PIECE);
      if (!pieceUnit) {
        try {
          await services.unit.create({
            code: UNIT_CODES.PIECE,
            name: "قطعة",
          });
          unitsList = await services.unit.getAll();
          pieceUnit = unitsList.find((u) => u.code === UNIT_CODES.PIECE);
        } catch {
          unitsList = await services.unit.getAll();
          pieceUnit = unitsList.find((u) => u.code === UNIT_CODES.PIECE);
        }
      }
      if (!pieceUnit) {
        notify.error("لم يتمكن النظام من تجهيز وحدة القطعة الأساسية");
        return;
      }
      setPieceUnitMeta(pieceUnit);
      setAllUnits(unitsList);

      // 2. Load categories
      const cats = await database
        .get<Category>("categories")
        .query(Q.sortBy("name", Q.asc))
        .fetch();
      setCategories(cats);

      // 3. Load posting accounts
      const accounts = await services.chartOfAccount.getPostingAccounts();
      setPostingAccounts(accounts);

      // 4. Load existing product (edit mode)
      if (editingId) {
        const product: ProductData | null = await services.product.getById(
          editingId,
        );
        if (!product) {
          notify.error("المنتج غير موجود");
          navigation.goBack();
          return;
        }

        setName(product.name);
        setSku(product.sku || "");
        setCategoryId(product.categoryId);
        setMinStock(String(product.minStock));
        setIsActive(product.isActive);

        // Split units: piece vs additional
        const pieceUnitId = pieceUnit.id;
        for (const u of product.units) {
          if (u.unitId === pieceUnitId) {
            setPieceUnitData({
              id: u.id,
              salePrice: String(u.salePrice),
              purchasePrice: String(u.purchasePrice),
              barcode: u.barcode || "",
            });
          } else {
            const unitMeta = unitsList.find((x) => x.id === u.unitId);
            setAdditionalUnits((prev) => [
              ...prev,
              {
                tempId: `existing-${u.id}`,
                id: u.id,
                unitId: u.unitId,
                unitName: unitMeta?.name,
                conversionFactor: String(u.conversionFactor),
                salePrice: String(u.salePrice),
                purchasePrice: String(u.purchasePrice),
                barcode: u.barcode || "",
              },
            ]);
          }
        }
      }
    } catch (error) {
      console.error(error);
      notify.error(
        error instanceof Error ? error.message : "فشل تحميل البيانات",
      );
    } finally {
      setIsLoading(false);
    }
  }, [editingId, navigation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Add additional unit ────────────────────────────────
  const addUnit = () => {
    const usedUnitIds = new Set([
      pieceUnitMeta?.id,
      ...additionalUnits.map((u) => u.unitId),
    ]);
    const available = allUnits.find((u) => !usedUnitIds.has(u.id));
    if (!available) {
      notify.warning("كل الوحدات مضافة بالفعل");
      return;
    }
    setAdditionalUnits((prev) => [
      ...prev,
      {
        tempId: `new-${Date.now()}`,
        unitId: available.id,
        unitName: available.name,
        conversionFactor: "",
        salePrice: "",
        purchasePrice: "",
        barcode: "",
      },
    ]);
  };

  const updateAdditionalUnit = (
    tempId: string,
    field: keyof AdditionalUnit,
    value: string,
  ) => {
    setAdditionalUnits((prev) =>
      prev.map((u) => (u.tempId === tempId ? { ...u, [field]: value } : u)),
    );
  };

  const removeAdditionalUnit = (tempId: string) => {
    setAdditionalUnits((prev) => prev.filter((u) => u.tempId !== tempId));
  };

  // ─── Validate and save ──────────────────────────────────
  const handleSave = async () => {
    // Local validation
    if (!name.trim()) {
      notify.warning("اسم المنتج مطلوب");
      return;
    }
    const minStockNum = parseInt(minStock);
    if (isNaN(minStockNum) || minStockNum < 0) {
      notify.warning("الحد الأدنى للمخزون يجب أن يكون رقماً صحيحاً");
      return;
    }

    if (!pieceUnitData.salePrice.trim()) {
      notify.warning("سعر بيع القطعة مطلوب");
      return;
    }
    const pieceSale = parseFloat(pieceUnitData.salePrice);
    const piecePurchase = parseFloat(pieceUnitData.purchasePrice || "0");
    if (isNaN(pieceSale) || pieceSale < 0) {
      notify.warning("سعر بيع القطعة غير صالح");
      return;
    }
    if (isNaN(piecePurchase) || piecePurchase < 0) {
      notify.warning("سعر شراء القطعة غير صالح");
      return;
    }

    for (const u of additionalUnits) {
      const factor = parseInt(u.conversionFactor);
      const sale = parseFloat(u.salePrice);
      const purchase = parseFloat(u.purchasePrice || "0");
      if (isNaN(factor) || factor <= 0) {
        notify.warning(`معامل التحويل غير صالح لـ "${u.unitName}"`);
        return;
      }
      if (isNaN(sale) || sale < 0) {
        notify.warning(`سعر البيع غير صالح لـ "${u.unitName}"`);
        return;
      }
      if (isNaN(purchase) || purchase < 0) {
        notify.warning(`سعر الشراء غير صالح لـ "${u.unitName}"`);
        return;
      }
    }

    if (isSaving || !pieceUnitMeta) return;

    // فحص مسبق: هل الـSKU مستخدم بالفعل؟
    if (sku.trim()) {
      const existing = await services.product.getBySku(
        sku.trim().toUpperCase(),
      );
      if (existing && existing.id !== editingId) {
        notify.error(`الـSKU "${sku}" مستخدم بالفعل لمنتج آخر`);
        return;
      }
    }

    setIsSaving(true);

    try {
      const unitsPayload = [
        {
          id: pieceUnitData.id,
          unitId: pieceUnitMeta.id,
          barcode: pieceUnitData.barcode.trim() || undefined,
          conversionFactor: 1,
          salePrice: pieceSale,
          purchasePrice: piecePurchase,
        },
        ...additionalUnits.map((u) => ({
          id: u.id,
          unitId: u.unitId,
          barcode: u.barcode.trim() || undefined,
          conversionFactor: parseInt(u.conversionFactor),
          salePrice: parseFloat(u.salePrice),
          purchasePrice: parseFloat(u.purchasePrice || "0"),
        })),
      ];

      const payload: CreateProductInput = {
        name: name.trim(),
        sku: sku.trim() || undefined,
        categoryId,
        minStock: minStockNum,
        isActive,
        units: unitsPayload,
      } as any;

      if (isEditMode && editingId) {
        await services.product.update(editingId, payload as any);
        notify.success("تم تحديث المنتج");
      } else {
        await services.product.create(payload);
        notify.success("تم إضافة المنتج");
      }
      navigation.goBack();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "فشل حفظ المنتج");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────
  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  const categoryOptions: PickerOption[] = [
    { id: "__none__", label: "بدون تصنيف" },
    ...categories.map((c) => ({ id: c.id, label: c.name })),
  ];

  const accountsByType = (type: string) =>
    postingAccounts
      .filter((a) => a.type === type)
      .map((a) => ({ id: a.id, label: a.name, sublabel: a.code }));

  const usedUnitIds = new Set([
    pieceUnitMeta?.id,
    ...additionalUnits.map((u) => u.unitId),
  ]);
  const hasAvailableUnits = allUnits.some((u) => !usedUnitIds.has(u.id));

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={isEditMode ? "تعديل المنتج" : "إضافة منتج جديد"}
        showBack
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Section: Basic Info ─── */}
          <Surface style={styles.section} elevation={1}>
            <View style={styles.sectionHeader}>
              <AppIcon
                name="package-variant"
                size={20}
                color={theme.colors.primary}
              />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                البيانات الأساسية
              </Text>
            </View>

            <TextInput
              label="اسم المنتج"
              value={name}
              onChangeText={setName}
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
            />

            <TextInput
              label="SKU (اختياري)"
              value={sku}
              onChangeText={(v) => setSku(v.toUpperCase())}
              mode="outlined"
              style={styles.input}
              right={
                <TextInput.Icon
                  icon={({ size, color }) => (
                    <AppIcon name="barcode" size={size} color={color} />
                  )}
                />
              }
              autoCapitalize="characters"
              placeholder="مثل: BEV-001"
            />

            <Picker
              label="التصنيف"
              value={categoryId || "__none__"}
              options={categoryOptions}
              placeholder="اختر تصنيفاً"
              onChange={(id) =>
                setCategoryId(id === "__none__" ? undefined : id)
              }
            />

            <TextInput
              label="الحد الأدنى للمخزون"
              value={minStock}
              onChangeText={setMinStock}
              keyboardType="number-pad"
              mode="outlined"
              style={styles.input}
              right={
                <TextInput.Icon
                  icon={({ size, color }) => (
                    <AppIcon name="package-variant" size={size} color={color} />
                  )}
                />
              }
            />

            <View style={styles.switchRow}>
              <Text variant="bodyMedium">تفعيل المنتج</Text>
              <Switch value={isActive} onValueChange={setIsActive} />
            </View>
          </Surface>

          {/* ─── Section: Units & Prices ─── */}
          <Surface style={styles.section} elevation={1}>
            <View style={styles.sectionHeader}>
              <AppIcon name="scale" size={20} color={theme.colors.primary} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                الوحدات والأسعار
              </Text>
            </View>

            {/* Piece unit (locked) */}
            <View
              style={[
                styles.pieceCard,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <View style={styles.pieceHeader}>
                <AppIcon
                  name="lock"
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  الوحدة الأساسية: {pieceUnitMeta?.name}
                </Text>
              </View>

              <TextInput
                label="سعر البيع (للقطعة)"
                value={pieceUnitData.salePrice}
                onChangeText={(v) =>
                  setPieceUnitData((p) => ({ ...p, salePrice: v }))
                }
                keyboardType="decimal-pad"
                mode="outlined"
                style={styles.input}
                dense
              />
              <TextInput
                label="سعر الشراء (للقطعة)"
                value={pieceUnitData.purchasePrice}
                onChangeText={(v) =>
                  setPieceUnitData((p) => ({ ...p, purchasePrice: v }))
                }
                keyboardType="decimal-pad"
                mode="outlined"
                style={styles.input}
                dense
              />
              <TextInput
                label="الباركود (اختياري)"
                value={pieceUnitData.barcode}
                onChangeText={(v) =>
                  setPieceUnitData((p) => ({ ...p, barcode: v }))
                }
                mode="outlined"
                style={styles.input}
                dense
                right={
                  <TextInput.Icon
                    icon="barcode-scan"
                    onPress={() => {
                      setScannerTarget("base");
                      setShowScanner(true);
                    }}
                  />
                }
              />
            </View>

            {/* Additional units */}
            {additionalUnits.map((u, idx) => (
              <View
                key={u.tempId}
                style={[
                  styles.additionalCard,
                  { borderColor: theme.colors.outlineVariant },
                ]}
              >
                <View style={styles.additionalHeader}>
                  <Text variant="titleSmall" style={{ fontWeight: "700" }}>
                    {u.unitName || `وحدة ${idx + 1}`}
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeAdditionalUnit(u.tempId)}
                    hitSlop={10}
                  >
                    <AppIcon
                      name="delete"
                      size={18}
                      color={theme.colors.error}
                    />
                  </TouchableOpacity>
                </View>

                <TextInput
                  label="معامل التحويل (كم قطعة في هذه الوحدة)"
                  value={u.conversionFactor}
                  onChangeText={(v) =>
                    updateAdditionalUnit(u.tempId, "conversionFactor", v)
                  }
                  keyboardType="number-pad"
                  mode="outlined"
                  style={styles.input}
                  dense
                />
                <TextInput
                  label="سعر البيع"
                  value={u.salePrice}
                  onChangeText={(v) =>
                    updateAdditionalUnit(u.tempId, "salePrice", v)
                  }
                  keyboardType="decimal-pad"
                  mode="outlined"
                  style={styles.input}
                  dense
                />
                <TextInput
                  label="سعر الشراء"
                  value={u.purchasePrice}
                  onChangeText={(v) =>
                    updateAdditionalUnit(u.tempId, "purchasePrice", v)
                  }
                  keyboardType="decimal-pad"
                  mode="outlined"
                  style={styles.input}
                  dense
                />
                <TextInput
                  label="الباركود (اختياري)"
                  value={u.barcode}
                  onChangeText={(v) =>
                    updateAdditionalUnit(u.tempId, "barcode", v)
                  }
                  mode="outlined"
                  style={styles.input}
                  dense
                  right={
                    <TextInput.Icon
                      icon="barcode-scan"
                      onPress={() => {
                        setScannerTarget(u.tempId);
                        setShowScanner(true);
                      }}
                    />
                  }
                />
              </View>
            ))}

            <Button
              mode="outlined"
              icon={({ size, color }) => (
                <AppIcon name="plus" size={size} color={color} />
              )}
              onPress={addUnit}
              disabled={!hasAvailableUnits}
              style={{ marginTop: 8 }}
            >
              إضافة وحدة أخرى
            </Button>
          </Surface>

          {/* ─── Save button ─── */}
          <Button
            mode="contained"
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
            style={styles.saveBtn}
            contentStyle={{ height: 48 }}
          >
            {isEditMode ? "حفظ التعديلات" : "حفظ المنتج"}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* ماسح الباركود */}
      <BarcodeScannerModal
        visible={showScanner}
        onDismiss={() => {
          setShowScanner(false);
          setScannerTarget(null);
        }}
        onCodeScanned={(code) => {
          if (scannerTarget === "base") {
            setPieceUnitData((p) => ({ ...p, barcode: code }));
          } else if (scannerTarget) {
            updateAdditionalUnit(scannerTarget, "barcode", code);
          }
          setShowScanner(false);
          setScannerTarget(null);
          notify.success(`تم قراءة الباركود: ${code}`);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  section: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontWeight: "700", fontSize: 16 },

  input: { marginBottom: 10, backgroundColor: "transparent" },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
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

  pieceCard: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  pieceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },

  additionalCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  additionalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  saveBtn: { borderRadius: 12, marginTop: 8 },
});
