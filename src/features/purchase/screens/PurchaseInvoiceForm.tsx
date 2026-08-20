/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput as RNTextInput,
} from "react-native";
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
// import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { useSuppliers } from "../hooks/usesuppliers";
import { useProductsSearch } from "../hooks/useProductsSearch";

import {
  purchaseInvoiceSchema,
  PurchaseInvoiceFormData,
} from "../schemas/purchaseInvoiceSchema";
import { purchaseRepository } from "../repositories/purchaseRepository";
// import { paperIcon } from "@shared/components/Icon";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ========== Hooks ==========
  const { suppliers } = useSuppliers(supplierSearch);
  const { products } = useProductsSearch(productSearch);

  // ========== React Hook Form ==========
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchaseInvoiceFormData>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      supplierId: "",
      invoiceDate: new Date(),
      paymentType: "cash",
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const _invoiceDate = watch("invoiceDate");
  const _paymentType = watch("paymentType");
  const items = watch("items");

  // ========== حساب الإجمالي ==========
  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0,
  );

  // ========== إضافة منتج ==========
  const handleAddProduct = () => {
    if (!selectedProduct || !selectedUnit || !quantity || !unitCost) {
      Alert.alert(t("common:error"), t("fillAllFields"));
      return;
    }

    const qty = parseFloat(quantity);
    const cost = parseFloat(unitCost);

    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
      Alert.alert(t("common:error"), t("invalidValues"));
      return;
    }

    append({
      productId: selectedProduct.id,
      productUnitId: selectedUnit.id,
      quantity: qty,
      unitCost: cost,
    });

    // إعادة تعيين الـ modal
    setShowProductModal(false);
    setProductSearch("");
    setSelectedProduct(null);
    setSelectedUnit(null);
    setQuantity("");
    setUnitCost("");
  };

  // ========== حذف بند ==========
  const handleDeleteItem = (index: number) => {
    remove(index);
  };

  // ========== حفظ كمسودة ==========
  const saveAsDraft = async (data: PurchaseInvoiceFormData) => {
    if (data.items.length === 0) {
      Alert.alert(t("common:error"), t("noItems"));
      return;
    }

    setIsLoading(true);
    try {
      await purchaseRepository.createDraft({
        supplierId: data.supplierId || undefined,
        invoiceDate: data.invoiceDate,
        paymentType: data.paymentType,
        items: data.items.map((item) => ({
          productId: item.productId,
          productUnitId: item.productUnitId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })),
      });
      Alert.alert(t("common:success"), t("savedAsDraft"));
      navigation.goBack();
    } catch (error) {
      console.log(error);
      Alert.alert(t("common:error"), t("common:operationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  // ========== ترحيل مباشر ==========
  const approveInvoice =  (data: PurchaseInvoiceFormData) => {
    if (data.items.length === 0) {
      Alert.alert(t("common:error"), t("noItems"));
      return;
    }

    Alert.alert(t("confirmApprove"), t("approveMessage"), [
      { text: t("common:cancel"), style: "cancel" },
      {
        text: t("common:confirm"),
        onPress: async () => {
          setIsLoading(true);
          try {
            // 1. حفظ كمسودة
            const draft = await purchaseRepository.createDraft({
              supplierId: data.supplierId || undefined,
              invoiceDate: data.invoiceDate,
              paymentType: data.paymentType,
              items: data.items.map((item) => ({
                productId: item.productId,
                productUnitId: item.productUnitId,
                quantity: item.quantity,
                unitCost: item.unitCost,
              })),
            });

            // 2. ترحيل مباشرة
            await purchaseRepository.approve(draft.id);

            Alert.alert(t("common:success"), t("approvedSuccess"));
            navigation.goBack();
          } catch (error) {
             console.log(error);
            Alert.alert(t("common:error"), t("common:operationFailed"));
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
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
            const isSelected = selectedProduct?.id === product.product.id;
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
                      icon="check-circle"
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
            <Text variant="titleSmall">{selectedProduct.name}</Text>
            <View style={styles.unitButtons}>
              {selectedProduct.units.map((unit: any) => (
                <Button
                  key={unit.id}
                  mode={selectedUnit?.id === unit.id ? "contained" : "outlined"}
                  onPress={() => setSelectedUnit(unit)}
                  style={styles.unitButton}
                >
                  {unit.unit?.name || "وحدة"}
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

  // ========== التصميم الرئيسي ==========
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
                />
                {supplierSearch.length > 0 && suppliers.length > 0 && (
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
              <DateTimePicker
                value={value}
                mode="date"
                display="default"
                onChange={(_, date) => date && onChange(date)}
              />
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
          {errors.paymentType && (
            <Text style={{ color: theme.colors.error, marginTop: 4 }}>
              {errors.paymentType.message}
            </Text>
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
                icon="barcode-scan"
                mode="contained"
                onPress={() => {
                  Alert.alert("📷", t("scanBarcode"));
                }}
              />
              <IconButton
                icon="plus"
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
                    {selectedProduct?.name || `منتج ${index + 1}`}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {item?.quantity || 0} × {item?.unitCost || 0}
                  </Text>
                </View>
                <CurrencyText
                  amount={(item?.quantity || 0) * (item?.unitCost || 0)}
                />
                <IconButton
                  icon="delete"
                  size={20}
                  onPress={() => handleDeleteItem(index)}
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
            mode="outlined"
            onPress={handleSubmit(saveAsDraft)}
            style={styles.draftButton}
            loading={isLoading}
          >
            {t("saveDraft")}
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit(approveInvoice)}
            style={styles.approveButton}
            loading={isLoading}
          >
            {t("approve")}
          </Button>
        </View>
      </ScrollView>

      {/* Modal إضافة المنتج */}
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
