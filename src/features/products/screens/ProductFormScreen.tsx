/* eslint-disable react-hooks/rules-of-hooks */
// screens/ProductFormScreen.tsx
import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import {
  Text,
  useTheme,
  TextInput,
  Button,
  Card,
  IconButton,
  Menu,
  Divider,
  Switch,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppHeader } from "@shared/components/AppHeader";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { productSchema, ProductForm } from "../schemas/productSchema";
import { database } from "@core/database";
import Product from "@core/database/models/Product";
import ProductUnit from "@core/database/models/ProductUnit";
import Unit from "@core/database/models/Unit";
import { Q } from "@nozbe/watermelondb";
import { UNIT_OPTIONS } from "@core/constants";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const ProductFormScreen: React.FC<{
  navigation: NavigationProp;
  route: { params?: { productId?: string } };
}> = ({ navigation, route }) => {
  const { productId } = route.params || {};
  const theme = useTheme();
  const { t } = useTranslation("products");
  const isEditing = !!productId;

  const [isLoading, setIsLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ========== react-hook-form ==========
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      categoryId: "",
      minStock: 0,
      isActive: true,
      units: [
        {
          unitId: "",
          barcode: "",
          conversionFactor: 1,
          salePrice: 0,
          purchasePrice: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "units",
  });

  const watchUnits = watch("units");

  // ========== جلب الوحدات من قاعدة البيانات ==========
  useEffect(() => {
    const loadUnits = async () => {
      const unitsCollection = database.get<Unit>("units");
      const allUnits = await unitsCollection
        .query(Q.sortBy("name", Q.asc))
        .fetch();
      setUnits(allUnits);
    };
    loadUnits();
  }, []);

  // ========== جلب بيانات المنتج (في حالة التعديل) ==========
  useEffect(() => {
    if (productId) {
      setIsLoading(true);
      const loadProduct = async () => {
        try {
          const productsCollection = database.get<Product>("products");
          const product = await productsCollection.find(productId);

          // جلب الوحدات المرتبطة
          const productUnitsCollection =
            database.get<ProductUnit>("product_units");
          const productUnits = await productUnitsCollection
            .query(Q.where("product_id", productId))
            .fetch();

          // تعبئة النموذج
          reset({
            name: product.name,
            sku: product.sku || "",
            categoryId: product.categoryId || "",
            minStock: product.minStock,
            isActive: product.isActive,
            units: productUnits.map((pu) => ({
              unitId: pu.unitId,
              barcode: pu.barcode || "",
              conversionFactor: pu.conversionFactor,
              salePrice: pu.salePrice,
              purchasePrice: pu.purchasePrice,
            })),
          });
        } catch (error) {
          Alert.alert(t("common:error"), t("common:operationFailed"));
          navigation.goBack();
        } finally {
          setIsLoading(false);
        }
      };
      loadProduct();
    }
  }, [productId, reset, navigation, t]);

  // ========== حفظ المنتج ==========
  const onSubmit = async (data: ProductForm) => {
    setIsLoading(true);
    try {
      await database.write(async () => {
        let product: Product;

        if (isEditing && productId) {
          // تحديث منتج موجود
          const productsCollection = database.get<Product>("products");
          product = await productsCollection.find(productId);
          await product.update((p) => {
            p.name = data.name;
            p.sku = data.sku || null;
            p.categoryId = data.categoryId || null;
            p.minStock = data.minStock;
            p.isActive = data.isActive;
          });

          // حذف الوحدات القديمة وإعادة إنشائها
          const productUnitsCollection =
            database.get<ProductUnit>("product_units");
          const oldUnits = await productUnitsCollection
            .query(Q.where("product_id", productId))
            .fetch();
          await Promise.all(oldUnits.map((unit) => unit.destroyPermanently()));
        } else {
          // إنشاء منتج جديد
          const productsCollection = database.get<Product>("products");
          product = await productsCollection.create((p) => {
            p.name = data.name;
            p.sku = data.sku || null;
            p.categoryId = data.categoryId || null;
            p.minStock = data.minStock;
            p.lastPurchaseCost = 0;
            p.isActive = data.isActive;
          });
        }

        // إنشاء الوحدات الجديدة
        const productUnitsCollection =
          database.get<ProductUnit>("product_units");
        await Promise.all(
          data.units.map((unitData) =>
            productUnitsCollection.create((pu) => {
              pu.productId = product.id;
              pu.unitId = unitData.unitId;
              pu.barcode = unitData.barcode || null;
              pu.conversionFactor = unitData.conversionFactor;
              pu.salePrice = unitData.salePrice;
              pu.purchasePrice = unitData.purchasePrice;
            }),
          ),
        );
      });

      Alert.alert(
        t("common:success"),
        isEditing ? t("productUpdated") : t("productCreated"),
        [{ text: t("common:ok"), onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert(t("common:error"), t("common:operationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  // ========== حذف المنتج (في حالة التعديل) ==========
  const handleDelete = async () => {
    if (!productId) {
      return;
    }
    setIsLoading(true);
    try {
      await database.write(async () => {
        const productsCollection = database.get<Product>("products");
        const product = await productsCollection.find(productId);
        await product.update((p) => {
          p.isActive = false;
        });
      });
      setShowDeleteDialog(false);
      navigation.goBack();
    } catch (error) {
      Alert.alert(t("common:error"), t("common:operationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  // ========== عرض القائمة المنسدلة للوحدات ==========
  const renderUnitMenu = (index: number) => {
    const [visible, setVisible] = useState(false);
    const selectedUnitId = watchUnits[index]?.unitId;

    return (
      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchor={
          <Button mode="outlined" onPress={() => setVisible(true)}>
            {selectedUnitId
              ? units.find((u) => u.id === selectedUnitId)?.name ||
                t("selectUnit")
              : t("selectUnit")}
          </Button>
        }
      >
        {units.map((unit) => (
          <Menu.Item
            key={unit.id}
            title={unit.name}
            onPress={() => {
              setValue(`units.${index}.unitId`, unit.id);
              setVisible(false);
            }}
          />
        ))}
      </Menu>
    );
  };

  // ========== واجهة المستخدم ==========
  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={isEditing ? t("editProduct") : t("addProduct")}
        showBack
        onBack={() => navigation.goBack()}
        actions={
          isEditing
            ? [{ icon: "delete", onPress: () => setShowDeleteDialog(true) }]
            : undefined
        }
      />

      <ScrollView style={styles.scrollView}>
        {/* ===== معلومات المنتج ===== */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t("productDetails")}
            </Text>

            {/* الاسم */}
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  label={t("name")}
                  value={value}
                  onChangeText={onChange}
                  error={!!errors.name}
                  mode="outlined"
                  style={styles.input}
                />
              )}
            />
            {errors.name && (
              <Text style={{ color: theme.colors.error }}>
                {errors.name.message}
              </Text>
            )}

            {/* SKU */}
            <Controller
              control={control}
              name="sku"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  label={t("sku")}
                  value={value}
                  onChangeText={onChange}
                  mode="outlined"
                  style={styles.input}
                />
              )}
            />

            {/* التصنيف (سيتم إضافته لاحقاً) */}

            {/* الحد الأدنى للمخزون */}
            <Controller
              control={control}
              name="minStock"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  label={t("minStock")}
                  value={String(value)}
                  onChangeText={(text) => onChange(parseFloat(text) || 0)}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                  error={!!errors.minStock}
                />
              )}
            />
            {errors.minStock && (
              <Text style={{ color: theme.colors.error }}>
                {errors.minStock.message}
              </Text>
            )}

            {/* تفعيل المنتج */}
            <Controller
              control={control}
              name="isActive"
              render={({ field: { onChange, value } }) => (
                <View style={styles.switchContainer}>
                  <Text>{t("active")}</Text>
                  <Switch value={value} onValueChange={onChange} />
                </View>
              )}
            />
          </Card.Content>
        </Card>

        {/* ===== الوحدات ===== */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.unitsHeader}>
              <Text variant="titleMedium">{t("units")}</Text>
              <IconButton
                icon="plus"
                mode="contained"
                onPress={() =>
                  append({
                    unitId: "",
                    barcode: "",
                    conversionFactor: 1,
                    salePrice: 0,
                    purchasePrice: 0,
                  })
                }
              />
            </View>

            {fields.map((field, index) => {
              // حالة محلية لكل عنصر وحدة لمعرفة هل القائمة مفتوحة أم لا
              const [menuVisible, setMenuVisible] = useState(false);
              const selectedUnitId = watchUnits[index]?.unitId;
              const selectedUnitName =
                units.find((u) => u.id === selectedUnitId)?.name ||
                t("selectUnit");

              return (
                <View key={field.id} style={styles.unitCard}>
                  <View style={styles.unitHeader}>
                    <Text variant="titleSmall">
                      {t("unit")} {index + 1}
                    </Text>
                    {fields.length > 1 && (
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => remove(index)}
                      />
                    )}
                  </View>

                  {/* اختيار الوحدة عبر Menu حقيقية ومتجاوبة */}
                  <Controller
                    control={control}
                    name={`units.${index}.unitId`}
                    render={() => (
                      <View style={styles.input}>
                        <Menu
                          visible={menuVisible}
                          onDismiss={() => setMenuVisible(false)}
                          anchor={
                            <Button
                              mode="outlined"
                              onPress={() => setMenuVisible(true)}
                              style={{ justifyContent: "flex-start" }}
                            >
                              {selectedUnitName}
                            </Button>
                          }
                        >
                          {UNIT_OPTIONS.map((unit) => (
                            <Menu.Item
                              key={unit.value}
                              title={unit.labelKey}
                              onPress={() => {
                                setValue(`units.${index}.unitId`, unit.value);
                                setMenuVisible(false);
                              }}
                            />
                          ))}
                        </Menu>
                      </View>
                    )}
                  />
                  {errors.units?.[index]?.unitId && (
                    <Text style={{ color: theme.colors.error }}>
                      {errors.units[index]?.unitId?.message}
                    </Text>
                  )}

                  {/* الباركود */}
                  <Controller
                    control={control}
                    name={`units.${index}.barcode`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        label={t("barcode")}
                        value={value || ""}
                        onChangeText={onChange}
                        mode="outlined"
                        style={styles.input}
                      />
                    )}
                  />

                  {/* عامل التحويل */}
                  <Controller
                    control={control}
                    name={`units.${index}.conversionFactor`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        label={t("conversionFactor")}
                        value={String(value)}
                        onChangeText={(text) => onChange(parseFloat(text) || 1)}
                        keyboardType="numeric"
                        mode="outlined"
                        style={styles.input}
                        error={!!errors.units?.[index]?.conversionFactor}
                      />
                    )}
                  />
                  {errors.units?.[index]?.conversionFactor && (
                    <Text style={{ color: theme.colors.error }}>
                      {errors.units[index]?.conversionFactor?.message}
                    </Text>
                  )}

                  {/* سعر البيع */}
                  <Controller
                    control={control}
                    name={`units.${index}.salePrice`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        label={t("salePrice")}
                        value={String(value)}
                        onChangeText={(text) => onChange(parseFloat(text) || 0)}
                        keyboardType="numeric"
                        mode="outlined"
                        style={styles.input}
                        error={!!errors.units?.[index]?.salePrice}
                      />
                    )}
                  />
                  {errors.units?.[index]?.salePrice && (
                    <Text style={{ color: theme.colors.error }}>
                      {errors.units[index]?.salePrice?.message}
                    </Text>
                  )}

                  {/* سعر الشراء */}
                  <Controller
                    control={control}
                    name={`units.${index}.purchasePrice`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        label={t("purchasePrice")}
                        value={String(value)}
                        onChangeText={(text) => onChange(parseFloat(text) || 0)}
                        keyboardType="numeric"
                        mode="outlined"
                        style={styles.input}
                        error={!!errors.units?.[index]?.purchasePrice}
                      />
                    )}
                  />
                  {errors.units?.[index]?.purchasePrice && (
                    <Text style={{ color: theme.colors.error }}>
                      {errors.units[index]?.purchasePrice?.message}
                    </Text>
                  )}

                  <Divider style={styles.unitDivider} />
                </View>
              );
            })}

            {errors.units?.message && (
              <Text style={{ color: theme.colors.error, marginTop: 8 }}>
                {errors.units.message}
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* ===== أزرار الحفظ ===== */}
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            style={styles.saveButton}
            loading={isLoading}
          >
            {isEditing ? t("common:update") : t("common:save")}
          </Button>
        </View>
      </ScrollView>

      {/* حوار تأكيد الحذف */}
      <ConfirmDialog
        visible={showDeleteDialog}
        title={t("deleteProduct")}
        message={t("deleteConfirm")}
        confirmLabel={t("common:delete")}
        onConfirm={handleDelete}
        onDismiss={() => setShowDeleteDialog(false)}
        destructive
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, paddingBottom: 20 },
  card: { margin: 16, marginBottom: 0 },
  sectionTitle: { fontWeight: "700", marginBottom: 12 },
  input: { marginBottom: 8 },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 8,
  },
  unitsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  unitCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  unitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  unitPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  unitPickerButton: { marginRight: 4, marginBottom: 4 },
  unitDivider: { marginVertical: 8 },
  buttonContainer: { padding: 16, paddingBottom: 40 },
  saveButton: { borderRadius: 8 },
});
