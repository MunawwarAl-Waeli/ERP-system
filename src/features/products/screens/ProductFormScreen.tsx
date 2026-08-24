import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import {
  useTheme,
  Button,
  TextInput,
  Text,
  Card,
  HelperText,
  Surface,
  IconButton,
  Portal,
  Dialog,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { database } from "@core/database";
import Category from "@core/database/models/Category";
import Unit from "@core/database/models/Unit";
import Product from "@core/database/models/Product";
import { Q } from "@nozbe/watermelondb";
import { AppHeader } from "@shared/components/AppHeader";
import { paperIcon } from "@shared/components/Icon";

// مخطط التحقق
const productSchema = z.object({
  name: z.string().min(2, "اسم المنتج مطلوب"),
  categoryId: z.string().min(1, "التصنيف مطلوب"),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  minStock: z.string().transform((val) => parseFloat(val) || 0),
  units: z
    .array(
      z.object({
        unitId: z.string().min(1, "الوحدة مطلوبة"),
        purchasePrice: z
          .string()
          .min(1, "سعر الشراء مطلوب")
          .transform((val) => parseFloat(val) || 0),
        salePrice: z
          .string()
          .min(1, "سعر البيع مطلوب")
          .transform((val) => parseFloat(val) || 0),
        isDefault: z.boolean().default(false),
        conversionFactor: z.number().default(1),
      }),
    )
    .min(1, "يجب إضافة وحدة قياس واحدة على الأقل"),
});

type ProductFormValues = z.infer<typeof productSchema>;

export const ProductFormScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const { t } = useTranslation(["common", "inventory"]);
  const productId = route.params?.productId;
  const isEditing = !!productId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // حالة مسح الباركود (محاكاة أو ربط مع الكاميرا)
  const [isScanning, setIsScanning] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      categoryId: "",
      sku: "",
      barcode: "",
      minStock: "0",
      units: [
        {
          unitId: "",
          purchasePrice: 0 as any,
          salePrice: 0 as any,
          isDefault: true,
          conversionFactor: 1,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "units" });

  // جلب البيانات الأساسية
  useEffect(() => {
    const loadData = async () => {
      const cats = await database.get<Category>("categories").query().fetch();
      const unts = await database.get<Unit>("units").query().fetch();
      setCategories(cats);
      setAvailableUnits(unts);

      if (isEditing) {
        const product = await database.get<Product>("products").find(productId);
        const pUnits = await product.productUnits.fetch();

        reset({
          name: product.name,
          categoryId: product.category.id,
          sku: product.sku || "",
          barcode: product.barcode || "",
          minStock: product.minStock?.toString() || "0",
          units: pUnits.map((pu) => ({
            unitId: pu.unit.id,
            purchasePrice: pu.purchasePrice.toString() as any,
            salePrice: pu.salePrice.toString() as any,
            isDefault: pu.isDefault,
            conversionFactor: pu.conversionFactor,
          })),
        });
      }
    };
    loadData();
  }, [productId]);

  const onSubmit = async (data: ProductFormValues) => {
    setIsSubmitting(true);
    try {
      await database.write(async () => {
        let product: Product;
        const category = await database
          .get<Category>("categories")
          .find(data.categoryId);

        if (isEditing) {
          product = await database.get<Product>("products").find(productId);
          await product.update((p) => {
            p.name = data.name;
            p.category.set(category);
            p.sku = data.sku || "";
            p.barcode = data.barcode || "";
            p.minStock = data.minStock;
          });

          // حذف الوحدات القديمة لإعادة إنشائها (تبسيط للتعديل)
          const oldUnits = await product.productUnits.fetch();
          await Promise.all(oldUnits.map((u) => u.markAsDeleted()));
        } else {
          product = await database.get<Product>("products").create((p) => {
            p.name = data.name;
            p.category.set(category);
            p.sku = data.sku || "";
            p.barcode = data.barcode || "";
            p.minStock = data.minStock;
            p.isActive = true;
          });
        }

        // إنشاء وحدات المنتج
        for (const u of data.units) {
          const unitRecord = await database.get<Unit>("units").find(u.unitId);
          await database.get("product_units").create((pu: any) => {
            pu.product.set(product);
            pu.unit.set(unitRecord);
            pu.purchasePrice = u.purchasePrice;
            pu.salePrice = u.salePrice;
            pu.isDefault = u.isDefault;
            pu.conversionFactor = u.conversionFactor;
          });
        }
      });

      Alert.alert(
        "تم بنجاح",
        isEditing ? "تم تحديث المنتج بنجاح" : "تم إضافة المنتج بنجاح",
      );
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("خطأ", "فشل حفظ المنتج. يرجى التحقق من البيانات.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBarcodeScan = () => {
    // هنا يتم استدعاء الكاميرا
    // للمحاكاة الآن، سنقوم بفتح تنبيه
    setIsScanning(true);
    // بمجرد الحصول على الباركود من الكاميرا:
    // setValue("barcode", scannedCode);
    // setIsScanning(false);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <AppHeader title={isEditing ? "تعديل منتج" : "إضافة منتج جديد"} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* بطاقة المعلومات الأساسية */}
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              المعلومات الأساسية
            </Text>

            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  label="اسم المنتج *"
                  value={value}
                  onChangeText={onChange}
                  error={!!errors.name}
                  mode="outlined"
                  style={styles.input}
                />
              )}
            />
            {errors.name && (
              <HelperText type="error">{errors.name.message}</HelperText>
            )}

            <View style={styles.row}>
              <Controller
                control={control}
                name="barcode"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    label="الباركود"
                    value={value}
                    onChangeText={onChange}
                    mode="outlined"
                    style={[styles.input, { flex: 1 }]}
                    right={
                      <TextInput.Icon
                        icon={paperIcon("camera")}
                        onPress={handleBarcodeScan}
                      />
                    }
                  />
                )}
              />
            </View>

            <Controller
              control={control}
              name="categoryId"
              render={({ field: { value } }) => (
                <View style={{ marginBottom: 12 }}>
                  <Text variant="bodySmall" style={{ marginBottom: 4 }}>
                    التصنيف *
                  </Text>
                  <Surface style={styles.pickerSurface} elevation={0}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {categories.map((cat) => (
                        <Button
                          key={cat.id}
                          mode={value === cat.id ? "contained" : "outlined"}
                          onPress={() => setValue("categoryId", cat.id)}
                          style={styles.chip}
                          compact
                        >
                          {cat.name}
                        </Button>
                      ))}
                    </ScrollView>
                  </Surface>
                </View>
              )}
            />
          </Card.Content>
        </Card>

        {/* بطاقة وحدات القياس والأسعار */}
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                وحدات القياس والأسعار
              </Text>
              <Button
                icon="plus"
                onPress={() =>
                  append({
                    unitId: "",
                    purchasePrice: 0 as any,
                    salePrice: 0 as any,
                    isDefault: false,
                    conversionFactor: 1,
                  })
                }
              >
                إضافة وحدة
              </Button>
            </View>

            {fields.map((field, index) => (
              <Surface
                key={field.id}
                style={styles.unitContainer}
                elevation={1}
              >
                <View style={styles.unitHeader}>
                  <Text variant="labelLarge">وحدة رقم {index + 1}</Text>
                  {fields.length > 1 && (
                    <IconButton
                      icon="delete"
                      iconColor={theme.colors.error}
                      onPress={() => remove(index)}
                    />
                  )}
                </View>

                <Controller
                  control={control}
                  name={`units.${index}.unitId`}
                  render={({ field: { value } }) => (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 12 }}
                    >
                      {availableUnits.map((u) => (
                        <Button
                          key={u.id}
                          mode={value === u.id ? "contained-tonal" : "outlined"}
                          onPress={() =>
                            setValue(`units.${index}.unitId`, u.id)
                          }
                          style={styles.chip}
                          compact
                        >
                          {u.name}
                        </Button>
                      ))}
                    </ScrollView>
                  )}
                />

                <View style={styles.priceRow}>
                  <Controller
                    control={control}
                    name={`units.${index}.purchasePrice`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        label="سعر الشراء"
                        value={value.toString()}
                        onChangeText={onChange}
                        keyboardType="numeric"
                        mode="outlined"
                        style={styles.priceInput}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`units.${index}.salePrice`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        label="سعر البيع"
                        value={value.toString()}
                        onChangeText={onChange}
                        keyboardType="numeric"
                        mode="outlined"
                        style={styles.priceInput}
                      />
                    )}
                  />
                </View>
              </Surface>
            ))}
          </Card.Content>
        </Card>

        {/* بطاقة المخزون */}
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              إعدادات المخزون
            </Text>
            <Controller
              control={control}
              name="minStock"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  label="الحد الأدنى للمخزون (تنبيه النقص)"
                  value={value.toString()}
                  onChangeText={onChange}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                />
              )}
            />
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          style={styles.submitBtn}
          contentStyle={{ paddingVertical: 8 }}
        >
          {isEditing ? "تحديث المنتج" : "حفظ المنتج الجديد"}
        </Button>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* مودال مسح الباركود (Placeholder) */}
      <Portal>
        <Dialog visible={isScanning} onDismiss={() => setIsScanning(false)}>
          <Dialog.Title>مسح الباركود</Dialog.Title>
          <Dialog.Content>
            <View style={styles.cameraPlaceholder}>
              <IconButton icon="camera" size={60} />
              <Text>جاري تشغيل الكاميرا...</Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsScanning(false)}>إلغاء</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  card: { marginBottom: 16, borderRadius: 12 },
  sectionTitle: { marginBottom: 16, fontWeight: "bold" },
  input: { marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center" },
  pickerSurface: { padding: 8, borderRadius: 8, marginBottom: 8 },
  chip: { marginRight: 8, marginBottom: 4 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  unitContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  unitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  priceRow: { flexDirection: "row", gap: 8 },
  priceInput: { flex: 1 },
  submitBtn: { marginTop: 8, borderRadius: 8 },
  cameraPlaceholder: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
  },
});
