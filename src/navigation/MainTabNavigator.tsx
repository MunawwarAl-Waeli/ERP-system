/* eslint-disable complexity */
import React, { useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  useTheme,
  Portal,
  Modal,
  Button,
  Text,
  TextInput,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@shared/components/Icon";
import { MainTabParamList } from "./types";
import { DashboardStack } from "./DashboardStack";
import { CustomerStack } from "./CustomerStack";
import { BillingStack } from "./BillingStack";
import { InventoryStack } from "./InventoryStack";
import { MoreStack } from "./MoreStack";
import { database } from "@core/database";
import Customer from "@core/database/models/Customer";
import ReceiptVoucher from "@core/database/models/ReceiptVoucher";
import PaymentVoucher from "@core/database/models/PaymentVoucher";
import { generateNumber } from "@shared/utils/id";

const Tab = createBottomTabNavigator<MainTabParamList>();
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export const MainTabNavigator: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();

  // State for Quick Transaction Modal (Central Button)
  const [modalVisible, setModalVisible] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [transactionType, setTransactionType] = useState<"receipt" | "payment">(
    "receipt",
  ); // receipt = سند قبض (له), payment = سند صرف (عليه)

  // Load customers for quick search
  const handleOpenModal = async () => {
    try {
      const list = await database.get<Customer>("customers").query().fetch();
      setCustomers(list);
      setModalVisible(true);
      setSearchQuery("");
      setSelectedCustomer(null);
      setAmount("");
      setNotes("");
    } catch (e) {
      Alert.alert("خطأ", "تعذر جلب قائمة العملاء.");
    }
  };

  const handleSaveQuickTransaction = async () => {
    if (!selectedCustomer) {
      Alert.alert("تنبيه", "يرجى اختيار العميل.");
      return;
    }
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert("تنبيه", "يرجى إدخال مبلغ صحيح أكبر من الصفر.");
      return;
    }

    try {
      await database.write(async () => {
        if (transactionType === "receipt") {
          // سند قبض (قبض من عميل - له)
          await database
            .get<ReceiptVoucher>("receipt_vouchers")
            .create((rv) => {
              rv.voucherNumber = generateNumber("REC");
              rv.voucherDate = new Date();
              rv.receiptAccountId = "cash_account";
              rv.customerId = selectedCustomer.id;
              rv.amount = numericAmount;
              rv.description =
                notes || `سند قبض سريع من العميل ${selectedCustomer.name}`;
              rv.createdBy = "user";
              rv.status = "posted";
            });
        } else {
          // سند صرف (صرف للعميل / عليه)
          await database
            .get<PaymentVoucher>("payment_vouchers")
            .create((pv) => {
              pv.voucherNumber = generateNumber("PAY");
              pv.voucherDate = new Date();
              pv.paymentAccountId = "cash_account";
              pv.referenceType = "customers";
              pv.referenceId = selectedCustomer.id;
              pv.amount = numericAmount;
              pv.description =
                notes || `سند صرف سريع للعميل ${selectedCustomer.name}`;
              pv.createdBy = "user";
              pv.status = "posted";
            });
        }
      });

      Alert.alert(
        "نجاح",
        "تم تسجيل الحركة المالية وتوليد القيد المحاسبي بنجاح.",
      );
      setModalVisible(false);
      setSelectedCustomer(null);
      setAmount("");
      setNotes("");
      setSearchQuery("");
    } catch (e: any) {
      console.error(e);
      Alert.alert("خطأ", e?.message || "حدث خطأ أثناء حفظ الحركة المالية.");
    }
  };

  // تصفية العملاء فقط عند وجود نص بحث وإذا لم يتم اختيار عميل بعد
  const filteredCustomers =
    searchQuery.trim().length > 0 && !selectedCustomer
      ? customers.filter(
          (c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.phone && c.phone.includes(searchQuery)),
        )
      : [];

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.surfaceVariant,
            height: 60 + (insets.bottom > 0 ? insets.bottom - 10 : 0),
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "500",
          },
        }}
      >
        <Tab.Screen
          name="DashboardTab"
          component={DashboardStack}
          options={{
            tabBarLabel: t("dashboard"),
            tabBarIcon: ({ color, size }) => (
              <AppIcon name="view-dashboard" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="CustomersTab"
          component={CustomerStack}
          options={{
            tabBarLabel: t("customers"),
            tabBarIcon: ({ color, size }) => (
              <AppIcon name="account-group" size={size} color={color} />
            ),
          }}
        />

        {/* زر الإجراء المركزي البارز (+) */}
        <Tab.Screen
          name="BillingTab"
          component={BillingStack}
          options={{
            tabBarButton: () => (
              <TouchableOpacity
                style={[
                  styles.centralButton,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={handleOpenModal}
                activeOpacity={0.8}
              >
                <AppIcon name="plus" size={28} color={theme.colors.onPrimary} />
              </TouchableOpacity>
            ),
            tabBarLabel: () => null,
          }}
        />

        <Tab.Screen
          name="InventoryTab"
          component={InventoryStack}
          options={{
            tabBarLabel: t("inventory"),
            tabBarIcon: ({ color, size }) => (
              <AppIcon
                name="package-variant-closed"
                size={size}
                color={color}
              />
            ),
          }}
        />

        <Tab.Screen
          name="MoreTab"
          component={MoreStack}
          options={{
            tabBarLabel: t("more"),
            tabBarIcon: ({ color, size }) => (
              <AppIcon name="dots-horizontal" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>

      {/* نافذة الحركة المالية السريعة للعميل */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.surface,
              maxHeight: SCREEN_HEIGHT * 0.8,
            },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flexShrink: 1 }}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text variant="titleLarge" style={styles.modalTitle}>
                إضافة حركة مالية سريعة
              </Text>

              {/* اختيار نوع الحركة: قبض (له) أو صرف (عليه) */}
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    {
                      backgroundColor:
                        transactionType === "receipt"
                          ? theme.colors.primaryContainer
                          : theme.colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => setTransactionType("receipt")}
                >
                  <Text
                    style={{
                      fontWeight: "bold",
                      color:
                        transactionType === "receipt"
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurfaceVariant,
                    }}
                  >
                    سند قبض (له)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    {
                      backgroundColor:
                        transactionType === "payment"
                          ? theme.colors.errorContainer
                          : theme.colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => setTransactionType("payment")}
                >
                  <Text
                    style={{
                      fontWeight: "bold",
                      color:
                        transactionType === "payment"
                          ? theme.colors.onErrorContainer
                          : theme.colors.onSurfaceVariant,
                    }}
                  >
                    سند صرف (عليه)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* بحث عن عميل */}
              <TextInput
                label="بحث عن العميل بالاسم أو الهاتف"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  if (selectedCustomer) setSelectedCustomer(null); // إذا عدل البحث، إلغاء التحديد السابق
                }}
                mode="outlined"
                style={styles.input}
              />

              {/* قائمة النتائج تظهر فقط عند البحث ولم يتم اختيار عميل */}
              {filteredCustomers.length > 0 && (
                <View
                  style={[
                    styles.customerListContainer,
                    { borderColor: theme.colors.outlineVariant },
                  ]}
                >
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 120 }}>
                    {filteredCustomers.map((cust) => (
                      <TouchableOpacity
                        key={cust.id}
                        style={styles.customerRow}
                        onPress={() => {
                          setSelectedCustomer(cust);
                          setSearchQuery(cust.name); // وضع اسم العميل في حقل البحث وإخفاء القائمة
                        }}
                      >
                        <Text>
                          {cust.name} {cust.phone ? `(${cust.phone})` : ""}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {selectedCustomer && (
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.colors.primary,
                    marginBottom: 8,
                    fontWeight: "bold",
                  }}
                >
                  ✓ تم اختيار العميل: {selectedCustomer.name}
                </Text>
              )}

              <TextInput
                label="المبلغ"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                mode="outlined"
                style={styles.input}
              />

              <TextInput
                label="ملاحظات / البيان"
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                style={styles.input}
              />

              <View style={styles.actionRow}>
                <Button
                  mode="outlined"
                  onPress={() => setModalVisible(false)}
                  style={styles.halfBtn}
                >
                  إلغاء
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveQuickTransaction}
                  style={styles.halfBtn}
                >
                  حفظ الحركة
                </Button>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  centralButton: {
    top: -16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    alignSelf: "center",
  },
  modalContainer: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    alignSelf: "center",
    width: "90%",
  },
  scrollContent: {
    paddingBottom: 8,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "bold",
  },
  typeSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  input: {
    marginBottom: 12,
  },
  customerListContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
  },
  customerRow: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  halfBtn: {
    flex: 1,
  },
});
