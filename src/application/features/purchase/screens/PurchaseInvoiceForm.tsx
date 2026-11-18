/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import {
  Text,
  useTheme,
  TextInput,
  Button,
  SegmentedButtons,
  IconButton,
  Surface,
  Portal,
  Modal,
  Searchbar,
  List,
  Divider,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker from "@react-native-community/datetimepicker";
import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { notify } from "@shared/notifications";
import { services } from "src/application/compositionRoot";

import { useSuppliers } from "../hooks/usesuppliers";
import { useProductsSearch } from "../hooks/useProductsSearch";

import {
  purchaseInvoiceSchema,
  PurchaseInvoiceFormData,
} from "../schemas/purchaseInvoiceSchema";
import ProductUnit from "src/database/models/ProductUnit";
import { Q } from "@nozbe/watermelondb";
import { database, Product, Unit } from "src/database";
import { BarcodeScannerModal } from "../components/BarcodeScannerModal";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

// ============================================================
// Helpers — safe text extraction from WatermelonDB Models
// ============================================================

/**
 * Extract a displayable unit label from an unknown shape.
 * The hook may return:
 *   - a plain string (e.g. "كرتونة")
 *   - a WatermelonDB Unit Model (has .name / .code)
 *   - a Relation object { id, fetch }
 *   - undefined / null
 * We never pass a Model directly to <Text> / <Button>.
 */
// ============================================================
// Helpers — safe text extraction from WatermelonDB Models
// ============================================================

function getUnitLabel(unitLike: any): string {
  if (!unitLike) return "وحدة";

  // 1. إذا كان نصاً (قد يكون الاسم أو الـ ID)
  if (typeof unitLike === "string") {
    // فحص إذا كان النص عبارة عن ID عشوائي من WatermelonDB (16 حرفاً)
    if (/^[a-zA-Z0-9]{16}$/.test(unitLike)) {
      return "وحدة"; // نتجاهل الـ ID ونضع كلمة افتراضية
    }
    return unitLike;
  }

  // 2. إذا كان كائناً (WatermelonDB Model أو Relation)
  if (typeof unitLike === "object") {
    // محاولة قراءة الاسم مباشرة
    if (typeof unitLike.name === "string") return unitLike.name;
    if (typeof unitLike.code === "string") return unitLike.code;

    // محاولة قراءة الاسم من داخل بيانات WatermelonDB الخام
    if (unitLike._raw) {
      if (typeof unitLike._raw.name === "string") return unitLike._raw.name;
      if (typeof unitLike._raw.code === "string") return unitLike._raw.code;
    }

    // محاولة قراءة الاسم إذا كان كائناً متداخلاً (Relation)
    if (unitLike.unit && typeof unitLike.unit === "object") {
      if (typeof unitLike.unit.name === "string") return unitLike.unit.name;
      if (typeof unitLike.unit.code === "string") return unitLike.unit.code;
      if (unitLike.unit._raw && typeof unitLike.unit._raw.name === "string") {
        return unitLike.unit._raw.name;
      }
    }

    // إذا كان هناك حقل مخصص للاسم مثل unitName
    if (typeof unitLike.unitName === "string") return unitLike.unitName;
  }

  return "وحدة";
}

function getTextOrEmpty(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, any>;
    if (typeof obj.name === "string") return obj.name;
    if (obj._raw && typeof obj._raw.name === "string") return obj._raw.name;
  }
  return "";
}

export const PurchaseInvoiceForm: React.FC<{
  navigation: NavigationProp;
}> = ({ navigation }) => {
  const theme = useTheme();
  const { t } = useTranslation("purchases");

  // ========== State ==========
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);
  const [pendingApproveData, setPendingApproveData] =
    useState<PurchaseInvoiceFormData | null>(null);

  // ... داخل المكون
  const [showScanner, setShowScanner] = useState(false);

  // أضف المكون في نهاية الـ JSX (قبل إغلاق SafeAreaView):

  // ========== Hooks ==========
  const { suppliers } = useSuppliers(supplierSearch);
  const { products } = useProductsSearch(productSearch);

  // ========== React Hook Form ==========
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PurchaseInvoiceFormData>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      supplierId: "",
      invoiceDate: new Date(),
      paymentType: "cash",
      createdBy: "local-user",
      items: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "items",
  });

  const invoiceDate = watch("invoiceDate");
  const paymentType = watch("paymentType");
  const items = watch("items");

  // ========== حساب الإجمالي ==========
  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0,
  );

  React.useEffect(() => {
    if (paymentType === "cash") setPaidAmount(totalAmount.toString());
    else if (paymentType === "credit") setPaidAmount("0");
    else if (
      paymentType === "partial" &&
      (!paidAmount || paidAmount === totalAmount.toString())
    )
      setPaidAmount("");
  }, [paymentType, totalAmount]);

  const handleBarcodeScanned = async (barcodeStr: string) => {
    if (!barcodeStr) return;

    try {
      const unitsCollection = database.get<ProductUnit>("product_units");
      const result = await unitsCollection
        .query(Q.where("barcode", barcodeStr))
        .fetch();

      if (result.length === 0) {
        notify.error("الباركود غير مسجل لأي منتج!");
        return;
      }

      const pu = result[0]; // ProductUnit Model

      // 2. جلب اسم المنتج واسم الوحدة
      const product = await database
        .get<Product>("products")
        .find(pu.productId);
      const masterUnit = await database.get<Unit>("units").find(pu.unitId);

      // 3. إضافة المنتج (الكمية الافتراضية 1، والسعر سعر الشراء)
      addOrMergeItem(
        product.id,
        product.name,
        pu.id,
        masterUnit.name,
        pu.conversionFactor,
        1, // الكمية 1
        pu.purchasePrice, // سعر التكلفة من بطاقة الوحدة
      );
    } catch (error) {
      console.error(error);
      notify.error("حدث خطأ أثناء قراءة الباركود");
    }
  };

  // ========== إضافة منتج ==========
  const handleAddProduct = () => {
    if (!selectedProduct || !selectedUnit || !quantity || !unitCost) {
      notify.warning(t("fillAllFields"));
      return;
    }

    const qty = parseFloat(quantity);
    const cost = parseFloat(unitCost);

    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
      notify.warning(t("invalidValues"));
      return;
    }

    // استدعاء الدالة الموحدة
    addOrMergeItem(
      selectedProduct.product.id,
      selectedProduct.product.name,
      selectedUnit.id,
      selectedUnit.unitName,
      selectedUnit.conversionFactor,
      qty,
      cost,
    );

    // إغلاق وتنظيف النافذة
    setShowProductModal(false);
    setProductSearch("");
    setSelectedProduct(null);
    setSelectedUnit(null);
    setQuantity("");
    setUnitCost("");
  };

  // ========== حفظ كمسودة ==========
  const saveAsDraft = async (data: PurchaseInvoiceFormData) => {
    if (data.items.length === 0) {
      notify.warning(t("noItems"));
      return;
    }

    setIsLoading(true);
    try {
      await services.purchaseInvoice.createDraft({
        supplierId: data.supplierId || undefined,
        invoiceDate: data.invoiceDate.toISOString().slice(0, 10),
        paymentType: data.paymentType,
        createdBy: data.createdBy,
        paidAmount: parseFloat(paidAmount),
        items: data.items,
      });
      notify.success(t("savedAsDraft"));
      navigation.goBack();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "فشل الحفظ");
    } finally {
      setIsLoading(false);
    }
  };

  // ========== ترحيل مباشر ==========
  const approveInvoice = (data: PurchaseInvoiceFormData) => {
    if (data.items.length === 0) {
      notify.warning(t("noItems"));
      return;
    }
    setPendingApproveData(data);
    setShowConfirmApprove(true);
  };

  const executeApproval = async () => {
    if (!pendingApproveData) return;
    const data = pendingApproveData;
    setShowConfirmApprove(false);

    setIsLoading(true);
    try {
      const draft = await services.purchaseInvoice.createDraft({
        supplierId: data.supplierId || undefined,
        invoiceDate: data.invoiceDate.toISOString().slice(0, 10),
        paymentType: data.paymentType,
        createdBy: data.createdBy || "local-user",
        paidAmount: parseFloat(paidAmount),
        items: data.items,
      });

      const numericPaid = parseFloat(paidAmount);
      await services.purchaseInvoice.post(draft.id, numericPaid);

      notify.success(t("approvedSuccess"));
      navigation.goBack();
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : t("common:operationFailed"),
      );
    } finally {
      setIsLoading(false);
      setPendingApproveData(null);
    }
  };
  // دالة مساعدة لإضافة منتج أو تحديثه إذا كان موجوداً
  const addOrMergeItem = (
    productId: string,
    productName: string,
    productUnitId: string,
    unitName: string,
    conversionFactor: number,
    qty: number,
    cost: number,
  ) => {
    // 1. البحث عن المنتج بنفس الوحدة
    const existingIndex = fields.findIndex(
      (item) =>
        item.productId === productId && item.productUnitId === productUnitId,
    );

    if (existingIndex > -1) {
      // 2. إذا كان موجوداً، نقوم بتحديث الكمية والإجمالي
      const existingItem = items[existingIndex];
      const newQty = existingItem.quantity + qty;

      update(existingIndex, {
        ...existingItem,
        quantity: newQty,
        total: newQty * existingItem.unitCost, // نحافظ على نفس سعر التكلفة القديم
        // أو يمكنك استخدام cost الجديد إذا أردت: total: newQty * cost
      });

      notify.success(`تم إضافة الكمية للمنتج ${productName} الموجود مسبقاً`);
    } else {
      // 3. إذا لم يكن موجوداً، نضيف سطراً جديداً
      append({
        productId,
        productUnitId,
        quantity: qty,
        unitCost: cost,
        total: qty * cost,
        _productName: productName,
        _unitName: unitName,
        _conversionFactor: conversionFactor,
      });

      notify.success(t("addSuccess") || "تمت الإضافة بنجاح");
    }
  };
  // ========== عرض قائمة المنتجات في الـ Modal ==========
  const renderProductModal = () => (
    <Portal>
      <Modal
        visible={showProductModal}
        onDismiss={() => setShowProductModal(false)}
        contentContainerStyle={[
          styles.modalContent,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Text variant="titleMedium" style={styles.modalTitle}>
          {t("addProduct")}
        </Text>

        <Searchbar
          placeholder={t("searchProduct")}
          value={productSearch}
          onChangeText={setProductSearch}
          style={styles.searchBar}
        />

        <ScrollView style={styles.productList}>
          {products.map((product) => {
            const isSelected =
              selectedProduct?.product.id === product.product.id;
            return (
              <List.Item
                key={product.product.id}
                title={getTextOrEmpty(product.product.name)}
                description={getTextOrEmpty(product.product.sku)}
                onPress={() => {
                  setSelectedProduct(product);
                  setSelectedUnit(product.units[0] || null);
                }}
                right={() =>
                  isSelected ? (
                    <IconButton
                      icon={paperIcon("check-circle")}
                      iconColor={theme.colors.primary}
                    />
                  ) : null
                }
              />
            );
          })}
          {products.length === 0 && (
            <Text style={{ textAlign: "center", marginTop: 20 }}>
              {t("noProductsFound")}
            </Text>
          )}
        </ScrollView>

        {selectedProduct && (
          <Surface style={styles.selectedProductCard} elevation={1}>
            <Text variant="titleSmall">
              {getTextOrEmpty(selectedProduct.product.name)}
            </Text>
            <View style={styles.unitButtons}>
              {selectedProduct.units.map((unit: any) => (
                <Button
                  key={unit.id}
                  mode={selectedUnit?.id === unit.id ? "contained" : "outlined"}
                  onPress={() => setSelectedUnit(unit)}
                  style={styles.unitButton}
                >
                  {unit.unitName}
                </Button>
              ))}
            </View>

            <View style={styles.inputRow}>
              <TextInput
                label={t("quantity")}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                mode="outlined"
                style={styles.smallInput}
              />
              <TextInput
                label={t("unitCost")}
                value={unitCost}
                onChangeText={setUnitCost}
                keyboardType="numeric"
                mode="outlined"
                style={styles.smallInput}
              />
            </View>

            <Button
              mode="contained"
              onPress={handleAddProduct}
              style={styles.addButton}
            >
              {t("add")}
            </Button>
          </Surface>
        )}
      </Modal>
    </Portal>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={t("newInvoice")}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.scrollView}>
        {/* ===== المورد ===== */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={styles.label}>
            {t("supplier")}
          </Text>
          <Controller
            control={control}
            name="supplierId"
            render={({ field: { onChange, value } }) => (
              <>
                <Searchbar
                  placeholder={t("searchSupplier")}
                  value={supplierSearch}
                  onChangeText={setSupplierSearch}
                  style={styles.searchBar}
                  icon={() => <AppIcon name="search" size={20} />}
                />
                {supplierSearch.length > 0 &&
                  suppliers.length > 0 &&
                  !value && (
                    <Surface style={styles.supplierDropdown} elevation={2}>
                      {suppliers.map((supplier) => (
                        <List.Item
                          key={supplier.id}
                          title={getTextOrEmpty(supplier.name)}
                          description={getTextOrEmpty(supplier.phone)}
                          onPress={() => {
                            onChange(supplier.id);
                            setSupplierSearch(supplier.name);
                          }}
                        />
                      ))}
                    </Surface>
                  )}
                {errors.supplierId && (
                  <Text style={{ color: theme.colors.error, marginTop: 4 }}>
                    {errors.supplierId.message}
                  </Text>
                )}
              </>
            )}
          />
        </View>

        {/* ===== التاريخ ===== */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={styles.label}>
            {t("date")}
          </Text>
          <Controller
            control={control}
            name="invoiceDate"
            render={({ field: { onChange, value } }) => (
              <>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={[
                    styles.dateButton,
                    {
                      borderColor: theme.colors.outlineVariant,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                >
                  <AppIcon
                    name="calendar"
                    size={20}
                    color={theme.colors.primary}
                    style={{ marginLeft: 8 }}
                  />
                  <Text>
                    {value.toLocaleDateString("ar-EG", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={value}
                    mode="date"
                    display="default"
                    onChange={(_, date) => {
                      setShowDatePicker(false);
                      if (date) onChange(date);
                    }}
                  />
                )}
              </>
            )}
          />
        </View>

        {/* ===== نوع الدفع ===== */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={styles.label}>
            {t("paymentType")}
          </Text>
          <Controller
            control={control}
            name="paymentType"
            render={({ field: { onChange, value } }) => (
              <SegmentedButtons
                value={value}
                onValueChange={(val) =>
                  onChange(val as "cash" | "credit" | "partial")
                }
                buttons={[
                  { value: "cash", label: t("cash") },
                  { value: "credit", label: t("credit") },
                  { value: "partial", label: t("partial") },
                ]}
              />
            )}
          />

          {(paymentType === "cash" || paymentType === "partial") && (
            <TextInput
              label="المبلغ المدفوع"
              value={paidAmount}
              onChangeText={setPaidAmount}
              keyboardType="numeric"
              mode="outlined"
              style={{ marginTop: 12 }}
              disabled={paymentType === "cash"}
              right={<TextInput.Affix text="ر.ي" />}
            />
          )}
        </View>

        {/* ===== قائمة المنتجات ===== */}
        <View style={styles.section}>
          <View style={styles.itemsHeader}>
            <Text variant="labelLarge" style={styles.label}>
              {t("items")} ({items.length})
            </Text>
            <View style={styles.actionButtons}>
              <IconButton
                icon={paperIcon("barcode")}
                mode="contained"
                onPress={() => setShowScanner(true)}
              />
              <IconButton
                icon={paperIcon("plus")}
                mode="contained"
                onPress={() => setShowProductModal(true)}
              />
            </View>
          </View>

          {fields.map((field, index) => {
            const item = items[index];
            const productName = item._productName ?? `منتج ${index + 1}`;
            const unitName = item._unitName ?? "";
            const lineTotal = (item?.quantity || 0) * (item?.unitCost || 0);

            // حساب الكمية بالقطعة للعرض (تحويل داخلي للفهم)
            const baseQty =
              (item?.quantity || 0) * (item._conversionFactor ?? 1);
            const showBaseQty =
              item._conversionFactor !== undefined &&
              item._conversionFactor !== 1;

            return (
              <View key={field.id} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text variant="bodyMedium" style={{ fontWeight: "500" }}>
                    {productName}
                  </Text>

                  {/* السطر الرئيسي: 5 كرتونة × 5,000 */}
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {item.quantity} {unitName ? `${unitName} ` : ""}×{" "}
                    {item.unitCost.toLocaleString("ar-EG")}
                  </Text>

                  {/* السطر الثانوي: التحويل للمخزون */}
                  {showBaseQty && (
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.primary, marginTop: 2 }}
                    >
                      ≈ {baseQty} قطعة في المخزون
                    </Text>
                  )}
                </View>

                <CurrencyText amount={lineTotal} />

                <IconButton
                  icon={paperIcon("delete")}
                  size={20}
                  iconColor={theme.colors.error}
                  onPress={() => remove(index)}
                />
              </View>
            );
          })}

          {errors.items && (
            <Text style={{ color: theme.colors.error, marginTop: 4 }}>
              {errors.items.message}
            </Text>
          )}
        </View>

        {/* ===== الإجمالي ===== */}
        <Surface style={styles.totalCard} elevation={2}>
          <Text variant="titleMedium">{t("total")}</Text>
          <CurrencyText amount={totalAmount} variant="headlineMedium" />

          {/* ملخّص سريع */}
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {items.length} صنف •{" "}
            {items.reduce(
              (sum, i) => sum + i.quantity * (i._conversionFactor ?? 1),
              0,
            )}{" "}
            قطعة إجمالاً
          </Text>
        </Surface>

        {/* ===== أزرار الحفظ ===== */}
        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            onPress={handleSubmit(saveAsDraft)}
            style={styles.draftButton}
            loading={isLoading}
            disabled={isLoading}
            icon={({ size }) => <AppIcon name="file-text" size={size} />}
          >
            {t("saveDraft")}
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit(approveInvoice)}
            style={styles.approveButton}
            loading={isLoading}
            disabled={isLoading}
            icon={({ size }) => (
              <AppIcon name="check" size={size} color="#fff" />
            )}
          >
            {t("approve")}
          </Button>
        </View>
      </ScrollView>
      {renderProductModal()}
      <ConfirmDialog
        visible={showConfirmApprove}
        title={t("confirmApprove")}
        message={t("approveMessage")}
        confirmLabel={t("approve")}
        cancelLabel={t("common:cancel")}
        onConfirm={executeApproval}
        onDismiss={() => setShowConfirmApprove(false)}
      />
      <BarcodeScannerModal
        visible={showScanner}
        onDismiss={() => setShowScanner(false)}
        onCodeScanned={(code) => {
          setShowScanner(false);
          handleBarcodeScanned(code);
        }}
      />
      ;
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, padding: 16 },
  section: { marginBottom: 20 },
  label: { marginBottom: 8 },
  searchBar: { marginBottom: 4 },
  supplierDropdown: {
    maxHeight: 200,
    borderRadius: 8,
    marginTop: 4,
    zIndex: 10,
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
  },
  dateButton: {
    flexDirection: "row",
    padding: 14,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  itemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionButtons: {
    flexDirection: "row",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  itemLeft: { flex: 1 },
  totalCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 40,
  },
  draftButton: { flex: 1 },
  approveButton: { flex: 1 },
  modalContent: {
    padding: 24,
    margin: 20,
    borderRadius: 16,
    maxHeight: "90%",
  },
  modalTitle: {
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  productList: { maxHeight: 250 },
  selectedProductCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  unitButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 8,
  },
  unitButton: { marginRight: 4 },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 8,
  },
  smallInput: { flex: 1 },
  addButton: { marginTop: 8 },
});
