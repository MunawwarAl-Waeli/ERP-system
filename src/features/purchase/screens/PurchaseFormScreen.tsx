/* eslint-disable complexity */

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  useTheme,
  Button,
  TextInput,
  Divider,
  Portal,
  Modal,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { CurrencyText } from "@shared/components/CurrencyText";
import { database } from "@core/database";
import Supplier from "@core/database/models/Supplier";
import Product from "@core/database/models/Product";
import ProductUnit from "@core/database/models/ProductUnit";
import Unit from "@core/database/models/Unit";
import Category from "@core/database/models/Category";
import { Q } from "@nozbe/watermelondb";
import {
  purchaseRepository,
  PurchaseItemFormData,
} from "../repositories/purchaseRepository";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
  replace: (screen: string, params?: Record<string, unknown>) => void;
}

export const PurchaseFormScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null,
  );
  const [paymentType, setPaymentType] = useState<"cash" | "credit" | "partial">(
    "cash",
  );
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [items, setItems] = useState<PurchaseItemFormData[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Quick Add Modals state
  const [supplierModalVisible, setSupplierModalVisible] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  const [productModalVisible, setProductModalVisible] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategoryId, setNewProductCategoryId] = useState("");

  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      const sList = await database.get<Supplier>("suppliers").query().fetch();
      const pList = await database
        .get<Product>("products")
        .query(Q.where("is_active", true))
        .fetch();
      const uList = await database.get<Unit>("units").query().fetch();
      const cList = await database.get<Category>("categories").query().fetch();

      setSuppliers(sList);
      setProducts(pList);
      setUnits(uList);
      setCategories(cList);
    };
    loadData();
  }, []);

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0,
  );

  // Add Item to Purchase
  const handleAddDefaultItem = async () => {
    if (products.length === 0) {
      Alert.alert(
        "تنبيه",
        "يرجى إضافة منتج أولاً عبر زر الإضافة السريعة (+) بجانب قائمة المنتجات.",
      );
      return;
    }
    const defaultProduct = products[0];
    const productUnits = await database
      .get<ProductUnit>("product_units")
      .query(Q.where("product_id", defaultProduct.id))
      .fetch();

    const defaultUnitId = productUnits[0]?.id || "";

    setItems((prev) => [
      ...prev,
      {
        productId: defaultProduct.id,
        productUnitId: defaultUnitId,
        quantity: 1,
        unitCost: defaultProduct.lastPurchaseCost || 0,
      },
    ]);
  };

  const handleUpdateItem = (
    index: number,
    field: keyof PurchaseItemFormData,
    value: any,
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick Add Supplier
  const handleSaveNewSupplier = async () => {
    if (!newSupplierName.trim()) {
      Alert.alert("خطأ", "يرجى إدخال اسم المورد.");
      return;
    }
    await database.write(async () => {
      const newSup = await database.get<Supplier>("suppliers").create((s) => {
        s.name = newSupplierName.trim();
        s.phone = newSupplierPhone.trim() || undefined;
      });
      setSuppliers((prev) => [...prev, newSup]);
      setSelectedSupplierId(newSup.id);
    });
    setNewSupplierName("");
    setNewSupplierPhone("");
    setSupplierModalVisible(false);
  };

  // Quick Add Product
  const handleSaveNewProduct = async () => {
    if (!newProductName.trim()) {
      Alert.alert("خطأ", "يرجى إدخال اسم المنتج.");
      return;
    }
    await database.write(async () => {
      const newProd = await database.get<Product>("products").create((p) => {
        p.name = newProductName.trim();
        p.categoryId = newProductCategoryId || categories[0]?.id || "";
        p.minStock = 5;
        p.lastPurchaseCost = 0;
        p.isActive = true;
      });

      // Also create a default unit (piece) if units exist
      if (units.length > 0) {
        await database.get<ProductUnit>("product_units").create((pu) => {
          pu.productId = newProd.id;
          pu.unitId = units[0].id;
          pu.conversionFactor = 1;
          pu.salePrice = 0;
          pu.purchasePrice = 0;
        });
      }

      const pList = await database
        .get<Product>("products")
        .query(Q.where("is_active", true))
        .fetch();
      setProducts(pList);
    });
    setNewProductName("");
    setProductModalVisible(false);
  };

  // Submit Purchase Invoice
  const handleSubmit = async () => {
    if (items.length === 0) {
      Alert.alert("تنبيه", "لا يمكن حفظ فاتورة بدون بنود.");
      return;
    }

    if (
      (paymentType === "credit" || paymentType === "partial") &&
      !selectedSupplierId
    ) {
      Alert.alert("خطأ", "الفواتير الآجلة أو الجزئية تتطلب تحديد مورد.");
      return;
    }

    setIsLoading(true);
    try {
      const numericPaid =
        paymentType === "cash"
          ? subtotal
          : paymentType === "credit"
          ? 0
          : parseFloat(paidAmount) || 0;

      await purchaseRepository.create({
        supplierId: selectedSupplierId,
        invoiceDate: new Date(),
        paymentType,
        paidAmount: numericPaid,
        items,
        notes,
      });

      Alert.alert(
        "نجاح",
        "تم اعتماد فاتورة الشراء وتحديث المخزون والقيود المحاسبية بنجاح.",
        [{ text: "حسناً", onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert(
        "خطأ",
        error instanceof Error ? error.message : "حدث خطأ أثناء حفظ الفاتورة.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title="فاتورة مشتريات جديدة"
        actions={[{ icon: "check", onPress: handleSubmit }]}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        {/* قسم المورد وطريقة الدفع */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium">بيانات المورد والدفع</Text>
            <TouchableOpacity
              onPress={() => setSupplierModalVisible(true)}
              style={styles.quickAddIconBtn}
            >
              <AppIcon
                name="plus-circle"
                size={24}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.supplierSelectorRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              <TouchableOpacity
                style={[
                  styles.supplierChip,
                  {
                    backgroundColor: !selectedSupplierId
                      ? theme.colors.primaryContainer
                      : theme.colors.surfaceVariant,
                  },
                ]}
                onPress={() => setSelectedSupplierId(null)}
              >
                <Text
                  style={{
                    color: !selectedSupplierId
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurfaceVariant,
                  }}
                >
                  بدون مورد (نقدي مباشر)
                </Text>
              </TouchableOpacity>
              {suppliers.map((sup) => (
                <TouchableOpacity
                  key={sup.id}
                  style={[
                    styles.supplierChip,
                    {
                      backgroundColor:
                        selectedSupplierId === sup.id
                          ? theme.colors.primaryContainer
                          : theme.colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => setSelectedSupplierId(sup.id)}
                >
                  <Text
                    style={{
                      color:
                        selectedSupplierId === sup.id
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurfaceVariant,
                    }}
                  >
                    {sup.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* طريقة الدفع */}
          <View style={styles.paymentTypeRow}>
            {(["cash", "credit", "partial"] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.paymentTypeBtn,
                  {
                    borderColor:
                      paymentType === type
                        ? theme.colors.primary
                        : theme.colors.outline,
                    backgroundColor:
                      paymentType === type
                        ? theme.colors.primaryContainer
                        : "transparent",
                  },
                ]}
                onPress={() => setPaymentType(type)}
              >
                <Text
                  style={{
                    color:
                      paymentType === type
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurface,
                  }}
                >
                  {type === "cash"
                    ? "نقداً (كاش)"
                    : type === "credit"
                    ? "آجل (على الحساب)"
                    : "دفع جزئي"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {paymentType === "partial" && (
            <TextInput
              label="المبلغ المدفوع حالياً"
              value={paidAmount}
              onChangeText={setPaidAmount}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
            />
          )}
        </View>

        {/* قسم بنود الفاتورة */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium">بنود المشتريات ({items.length})</Text>
            <View style={styles.headerBtns}>
              <TouchableOpacity
                onPress={() => setProductModalVisible(true)}
                style={styles.quickAddIconBtn}
              >
                <AppIcon
                  name="package-variant-plus"
                  size={24}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
              <Button
                mode="contained-tonal"
                onPress={handleAddDefaultItem}
                compact
                icon={paperIcon("plus")}
              >
                إضافة بند
              </Button>
            </View>
          </View>

          <Divider style={styles.divider} />

          {items.length === 0 ? (
            <Text
              style={{
                textAlign: "center",
                color: theme.colors.onSurfaceVariant,
                paddingVertical: 20,
              }}
            >
              لم يتم إضافة منتجات للفاتورة بعد. انقر فوق "إضافة بند" أو زر (+)
              لإضافة منتج.
            </Text>
          ) : (
            items.map((item, index) => {
              const prod = products.find((p) => p.id === item.productId);
              return (
                <View
                  key={index}
                  style={[
                    styles.itemRow,
                    { borderBottomColor: theme.colors.outlineVariant },
                  ]}
                >
                  <View style={styles.itemHeader}>
                    <Text
                      variant="bodyLarge"
                      style={{ fontWeight: "750", flex: 1 }}
                    >
                      {prod?.name || "منتج"}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                      <AppIcon
                        name="trash-2"
                        size={18}
                        color={theme.colors.error}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.itemInputs}>
                    <TextInput
                      label="الكمية"
                      value={item.quantity.toString()}
                      onChangeText={(val) =>
                        handleUpdateItem(
                          index,
                          "quantity",
                          parseFloat(val) || 0,
                        )
                      }
                      keyboardType="numeric"
                      mode="outlined"
                      dense
                      style={styles.smallInput}
                    />
                    <TextInput
                      label="سعر التكلفة"
                      value={item.unitCost.toString()}
                      onChangeText={(val) =>
                        handleUpdateItem(
                          index,
                          "unitCost",
                          parseFloat(val) || 0,
                        )
                      }
                      keyboardType="numeric"
                      mode="outlined"
                      dense
                      style={styles.smallInput}
                    />
                  </View>
                  <Text
                    variant="labelMedium"
                    style={{
                      textAlign: "right",
                      marginTop: 4,
                      color: theme.colors.primary,
                    }}
                  >
                    الإجمالي:{" "}
                    <CurrencyText amount={item.quantity * item.unitCost} />
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* الملخص */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.summaryRow}>
            <Text variant="titleMedium">الإجمالي العام:</Text>
            <CurrencyText
              amount={subtotal}
              variant="titleLarge"
              style={{ color: theme.colors.primary, fontWeight: "bold" }}
            />
          </View>
        </View>
      </ScrollView>

      {/* مودال إضافة مورد جديد سريع */}
      <Portal>
        <Modal
          visible={supplierModalVisible}
          onDismiss={() => setSupplierModalVisible(false)}
          contentContainerStyle={[
            styles.modalContent,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            إضافة مورد جديد
          </Text>
          <TextInput
            label="اسم المورد"
            value={newSupplierName}
            onChangeText={setNewSupplierName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="رقم الهاتف (اختياري)"
            value={newSupplierPhone}
            onChangeText={setNewSupplierPhone}
            keyboardType="phone-pad"
            mode="outlined"
            style={styles.input}
          />
          <Button
            mode="contained"
            onPress={handleSaveNewSupplier}
            style={styles.modalBtn}
          >
            حفظ المورد
          </Button>
        </Modal>

        {/* مودال إضافة منتج جديد سريع */}
        <Modal
          visible={productModalVisible}
          onDismiss={() => setProductModalVisible(false)}
          contentContainerStyle={[
            styles.modalContent,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            إضافة منتج جديد
          </Text>
          <TextInput
            label="اسم المنتج / قطعة الغيار"
            value={newProductName}
            onChangeText={setNewProductName}
            mode="outlined"
            style={styles.input}
          />
          <Button
            mode="contained"
            onPress={handleSaveNewProduct}
            style={styles.modalBtn}
          >
            حفظ المنتج
          </Button>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  card: { padding: 16, borderRadius: 12, elevation: 2 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  quickAddIconBtn: { padding: 4 },
  supplierSelectorRow: { marginBottom: 12 },
  chipScroll: { gap: 8 },
  supplierChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  paymentTypeRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  paymentTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
  },
  input: { marginBottom: 12 },
  divider: { marginVertical: 8 },
  itemRow: { paddingVertical: 12, borderBottomWidth: 1 },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemInputs: { flexDirection: "row", gap: 12 },
  smallInput: { flex: 1 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalContent: { margin: 20, padding: 24, borderRadius: 12 },
  modalTitle: { marginBottom: 16, textAlign: "center" },
  modalBtn: { marginTop: 8 },
});
