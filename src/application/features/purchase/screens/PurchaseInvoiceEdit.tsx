/* eslint-disable @typescript-eslint/no-explicit-any */
// screens/PurchaseInvoiceEdit.tsx
import React, { useState, useEffect } from "react";
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
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker from "@react-native-community/datetimepicker";
import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { notify } from "@shared/notifications";
import { services } from "src/application/compositionRoot";
import { useSuppliers } from "../hooks/usesuppliers";
import { useProductsSearch } from "../hooks/useProductsSearch";

import {
  purchaseInvoiceSchema,
  PurchaseInvoiceFormData,
} from "../schemas/purchaseInvoiceSchema";
import { usePurchaseInvoiceDetail } from "../hooks/usePurchaseInvoices";
import { database } from "src/database";
import { Q } from "@nozbe/watermelondb";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const PurchaseInvoiceEdit: React.FC<{
  navigation: NavigationProp;
  route: { params: { invoiceId: string } };
}> = ({ navigation, route }) => {
  const { invoiceId } = route.params;
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
  const [isFormLoading, setIsFormLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [productNames, setProductNames] = useState<Record<string, string>>({});

  // ========== Hooks ==========
  const { suppliers } = useSuppliers(supplierSearch);
  const { products } = useProductsSearch(productSearch);
  const {
    invoice,
    items: existingItems,
    isLoading: isDetailLoading,
  } = usePurchaseInvoiceDetail(invoiceId);

  // ========== React Hook Form ==========
  const {
    control,
    handleSubmit,
    watch,
    reset,
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

  const { fields, append, remove } = useFieldArray({
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

  // ========== تحميل بيانات الفاتورة للتعديل ==========
  useEffect(() => {
    const loadInvoiceData = async () => {
      if (isDetailLoading || !invoice) return;

      if (invoice.status !== "draft") {
        notify.error("لا يمكن تعديل فاتورة تم ترحيلها");
        navigation.goBack();
        return;
      }

      try {
        // ✅ قراءة مباشرة من قاعدة البيانات (وليس من hook)
        const rawItems = await database
          .get("purchase_invoice_items")
          .query(Q.where("purchase_invoice_id", invoiceId))
          .fetch();

        console.log("[EDIT] Raw items count:", rawItems.length);

        const names: Record<string, string> = {};
        const mappedItems: any[] = [];

        for (const item of rawItems) {
          const raw: any = (item as any)._raw || {};
          console.log("[EDIT] Item _raw:", JSON.stringify(raw));

          const pId = raw.product_id || "";
          const puId = raw.product_unit_id || "";

          if (pId && !names[pId]) {
            try {
              const p = await database.get("products").find(pId);
              names[pId] = (p as any).name;
            } catch (e) {
              console.log("[EDIT] Product not found:", pId);
            }
          }

          mappedItems.push({
            productId: pId,
            productUnitId: puId,
            quantity: Number(raw.quantity ?? 0),
            unitCost: Number(raw.unit_cost ?? 0),
            total: Number(raw.total ?? 0),
          });
        }

        setProductNames(names);

        const supplierIdRaw =
          (invoice as any).supplierId ||
          (invoice as any)._raw?.supplier_id ||
          "";

        console.log("[EDIT] Supplier ID:", supplierIdRaw);

        reset({
          supplierId: supplierIdRaw,
          invoiceDate: new Date(invoice.invoiceDate),
          paymentType: invoice.paymentType as "cash" | "credit" | "partial",
          createdBy: (invoice as any).createdBy || "local-user",
          items: mappedItems,
        });

        if (supplierIdRaw) {
          try {
            const s = await database.get("suppliers").find(supplierIdRaw);
            setSupplierSearch((s as any).name || "");
          } catch {}
        }

        setIsFormLoading(false);
      } catch (err) {
        console.error("[EDIT] Failed to load:", err);
        notify.error("فشل تحميل بيانات الفاتورة");
        setIsFormLoading(false);
      }
    };
    loadInvoiceData();
  }, [isDetailLoading, invoice, invoiceId, reset, navigation]);

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

    append({
      productId: selectedProduct.product.id,
      productUnitId: selectedUnit.id,
      quantity: qty,
      unitCost: cost,
      total: qty * cost,
    });

    // تحديث أسماء المنتجات في الحالة
    setProductNames((prev) => ({
      ...prev,
      [selectedProduct.product.id]: selectedProduct.product.name,
    }));

    setShowProductModal(false);
    setProductSearch("");
    setSelectedProduct(null);
    setSelectedUnit(null);
    setQuantity("");
    setUnitCost("");
  };

  // ========== حفظ التعديلات ==========
  const saveChanges = async (data: PurchaseInvoiceFormData) => {
    if (data.items.length === 0) {
      notify.warning(t("noItems"));
      return;
    }

    setIsLoading(true);
    try {
      await services.purchaseInvoice.updateDraft(invoiceId, {
        supplierId: data.supplierId || undefined,
        invoiceDate: data.invoiceDate.toISOString().slice(0, 10),
        paymentType: data.paymentType,
        createdBy: data.createdBy,
        items: data.items,
      });
      notify.success(t("invoiceUpdated"));
      navigation.goBack();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "فشل التعديل");
    } finally {
      setIsLoading(false);
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
          icon={() => <AppIcon name="search" size={20} />}
        />

        <ScrollView style={styles.productList}>
          {products.map((product) => {
            const isSelected =
              selectedProduct?.product?.id === product.product.id;
            return (
              <List.Item
                key={product.product.id}
                title={product.product.name}
                description={product.product.sku}
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
            <Text variant="titleSmall">{selectedProduct.product.name}</Text>
            <View style={styles.unitButtons}>
              {selectedProduct.units.map((unit: any) => (
                <Button
                  key={unit.id}
                  mode={selectedUnit?.id === unit.id ? "contained" : "outlined"}
                  onPress={() => setSelectedUnit(unit)}
                  style={styles.unitButton}
                >
                  {unit.unitName || "وحدة"}
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

  // ========== عرض التحميل ==========
  if (isDetailLoading || isFormLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <LoadingOverlay visible />
      </SafeAreaView>
    );
  }

  // ========== التصميم الرئيسي ==========
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={t("editInvoice")}
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
                          title={supplier.name}
                          description={supplier.phone}
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
        </View>

        {/* ===== قائمة المنتجات ===== */}
        <View style={styles.section}>
          <View style={styles.itemsHeader}>
            <Text variant="labelLarge" style={styles.label}>
              {t("items")} ({items.length})
            </Text>
            <View style={styles.actionButtons}>
              <IconButton
                icon={paperIcon("plus")}
                mode="contained"
                onPress={() => setShowProductModal(true)}
              />
            </View>
          </View>

          {fields.map((field, index) => {
            const item = items[index];
            return (
              <View key={field.id} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text variant="bodyMedium" style={{ fontWeight: "500" }}>
                    {productNames[item.productId] || `منتج ${index + 1}`}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {item?.quantity || 0} × {item?.unitCost || 0}
                  </Text>
                </View>
                <CurrencyText amount={item?.total || 0} />
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
        </Surface>

        {/* ===== أزرار الحفظ ===== */}
        <View style={styles.buttonRow}>
          <Button
            mode="contained"
            onPress={handleSubmit(saveChanges, (errors) => {
              console.log("Form Validation Errors:", errors);
              notify.error("يرجى تعبئة جميع الحقول المطلوبة بشكل صحيح");
            })}
            style={{ flex: 1 }}
            loading={isLoading}
            disabled={isLoading}
          >
            {t("saveChanges")}
          </Button>
        </View>
      </ScrollView>

      {renderProductModal()}
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
