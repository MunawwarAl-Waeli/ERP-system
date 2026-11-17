import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Linking,
  View,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import {
  Button,
  Portal,
  Dialog,
  TextInput,
  Text,
  Chip,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";

import { createMMKV, type MMKV } from "react-native-mmkv";

import { AppHeader } from "@shared/components/AppHeader";
import { SearchInput } from "@shared/components/SearchInput";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { AppIcon } from "src/shared/components/Icon";
import { CustomerCard } from "../components/CustomerCard";
import Customer from "src/database/models/Customer";
import { getDetailedLedger } from "../repositories/customerRepository";
import { useCustomers, useCustomerCredits } from "../hooks/useCustomers";
import { useBillingStore } from "src/application/features/sales/store/useBillingStore";
import { customerPdfService } from "../services/customerPdfService";
import { notify } from "@shared/notifications";
import { Colors } from "src/core/theme/colors";

// ========================================
// Safe Storage Helper (MMKV)
// ========================================
const WA_TEMPLATE_KEY = "customer_wa_template_v1";
const SMS_TEMPLATE_KEY = "customer_sms_template_v1";

let mmkvInstance: MMKV | null = null;
const getStorage = (): MMKV | null => {
  if (!mmkvInstance) {
    try {
      mmkvInstance = createMMKV();
    } catch (e) {
      console.warn("[MMKV] Deferred initialization:", e);
    }
  }
  return mmkvInstance;
};

const getStoredTemplate = (key: string, fallback: string): string => {
  try {
    return getStorage()?.getString(key) || fallback;
  } catch {
    return fallback;
  }
};

const setStoredTemplate = (key: string, value: string): void => {
  try {
    getStorage()?.set(key, value);
  } catch (e) {
    console.warn("[MMKV] Save error:", e);
  }
};

type FilterType = "ALL" | "DEBT" | "BALANCED";
const PAGE_SIZE = 15;

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
  setParams: (params: Record<string, unknown>) => void;
}

interface RouteProp {
  params?: { selectionMode?: boolean };
}

export const CustomerListScreen: React.FC<{
  navigation: NavigationProp;
  route: RouteProp;
}> = ({ navigation, route }) => {
  const { t } = useTranslation("customers");

  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("ALL");

  // ✅ جلب البيانات والأرصدة عبر الهوكات النظيفة فقط دون خرق المعمارية
  const { customers, isLoading } = useCustomers(searchQuery);
  const { creditMap } = useCustomerCredits();

  const [page, setPage] = useState(1);
  const selectionMode = route.params?.selectionMode ?? false;
  const setCustomer = useBillingStore((state) => state.setCustomer);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);

  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(() =>
    getStoredTemplate(
      WA_TEMPLATE_KEY,
      "مرحباً {name}، نود تذكيركم بأن المبلغ المستحق لحسابكم هو {balance} ر.ي.",
    ),
  );
  const [smsTemplate, setSmsTemplate] = useState<string>(() =>
    getStoredTemplate(
      SMS_TEMPLATE_KEY,
      "مرحباً {name}، المبلغ المستحق لحسابكم هو {balance} ر.ي.",
    ),
  );
  const [bulkMessage, setBulkMessage] = useState(smsTemplate);

  const handleSaveTemplates = () => {
    setStoredTemplate(WA_TEMPLATE_KEY, whatsappTemplate);
    setStoredTemplate(SMS_TEMPLATE_KEY, smsTemplate);
    setShowTemplateSettings(false);
    notify.success("تم حفظ قوالب الرسائل بنجاح");
  };

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterType]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const credit = creditMap[customer.id] || 0;
      if (filterType === "DEBT") return credit > 0;
      if (filterType === "BALANCED") return credit <= 0;
      return true;
    });
  }, [customers, creditMap, filterType]);

  const statistics = useMemo(() => {
    let totalDebt = 0;
    let debtorsCount = 0;

    filteredCustomers.forEach((c) => {
      const credit = creditMap[c.id] || 0;
      if (credit > 0) {
        totalDebt += credit;
        debtorsCount += 1;
      }
    });

    return {
      totalCustomers: filteredCustomers.length,
      totalDebt,
      debtorsCount,
    };
  }, [filteredCustomers, creditMap]);

  const paginatedCustomers = useMemo(() => {
    return filteredCustomers.slice(0, page * PAGE_SIZE);
  }, [filteredCustomers, page]);

  const handleLoadMore = () => {
    if (paginatedCustomers.length < filteredCustomers.length) {
      setPage((prev) => prev + 1);
    }
  };

  const handleCall = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`);
  }, []);

  const handleWhatsapp = useCallback(
    (customer: Customer) => {
      const balance = (creditMap[customer.id] || 0).toLocaleString("en-US");
      const msg = whatsappTemplate
        .replace("{name}", customer.name)
        .replace("{balance}", balance);

      Linking.openURL(
        `https://wa.me/${customer.phone}?text=${encodeURIComponent(msg)}`,
      );
    },
    [creditMap, whatsappTemplate],
  );

  const handleSms = useCallback(
    (customer: Customer) => {
      const balance = (creditMap[customer.id] || 0).toLocaleString("en-US");
      const msg = smsTemplate
        .replace("{name}", customer.name)
        .replace("{balance}", balance);

      Linking.openURL(`sms:${customer.phone}?body=${encodeURIComponent(msg)}`);
    },
    [creditMap, smsTemplate],
  );

  const handleSharePdf = useCallback(
    async (customer: Customer) => {
      try {
        const ledger = await getDetailedLedger(customer.id);
        await customerPdfService.shareLedgerPdf(
          customer,
          ledger,
          creditMap[customer.id] || 0,
        );
      } catch (e) {
        notify.error("فشل في توليد ملف PDF");
      }
    },
    [creditMap],
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prevSet) => {
      const newSet = new Set(prevSet);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCustomers.map((c) => c.id)));
    }
  }, [filteredCustomers, selectedIds.size]);

  const handleSendBulk = () => {
    if (selectedIds.size === 0) {
      notify.warning("يرجى تحديد عميل واحد على الأقل.");
      return;
    }
    setBulkMessage(smsTemplate);
    setShowBulkModal(true);
  };

  const executeBulkSend = () => {
    setShowBulkModal(false);
    const selectedCustomers = customers.filter((c) => selectedIds.has(c.id));
    const phones = selectedCustomers
      .map((c) => c.phone)
      .filter(Boolean)
      .join(Platform.OS === "ios" ? "&" : ",");

    if (!phones) {
      notify.error("لا توجد أرقام هواتف مسجلة للعملاء المحددين.");
      return;
    }

    const sampleMsg = bulkMessage
      .replace("{name}", "العميل")
      .replace("{balance}", "المستحق");

    Linking.openURL(`sms:${phones}?body=${encodeURIComponent(sampleMsg)}`);

    notify.success(`تم تجهيز الرسالة لـ ${selectedCustomers.length} عميل`);
    setIsBulkMode(false);
    setSelectedIds(new Set());
  };

  const toggleSearch = useCallback(() => {
    setIsSearchVisible((prev) => {
      if (prev) setSearchQuery("");
      return !prev;
    });
  }, []);

  const renderCustomerItem = useCallback(
    ({ item }: { item: Customer }) => {
      const isSelected = selectedIds.has(item.id);

      const handlePress = () => {
        if (isBulkMode) {
          toggleSelection(item.id);
        } else if (selectionMode) {
          setCustomer(item.id);
          navigation.setParams({ selectionMode: false });
          navigation.navigate(
            "BillingTab" as never,
            {
              screen: "BillingHome",
            } as never,
          );
        } else {
          navigation.navigate("CustomerDetail", { customerId: item.id });
        }
      };

      return (
        <CustomerCard
          name={item.name}
          phone={item.phone}
          outstandingCredit={creditMap[item.id]}
          isSelectionMode={isBulkMode}
          isSelected={isSelected}
          onPress={handlePress}
          onCall={item.phone ? () => handleCall(item.phone) : undefined}
          onWhatsapp={() => handleWhatsapp(item)}
          onSms={() => handleSms(item)}
          onPdf={() => handleSharePdf(item)}
        />
      );
    },
    [
      isBulkMode,
      selectedIds,
      selectionMode,
      creditMap,
      toggleSelection,
      setCustomer,
      navigation,
      handleCall,
      handleWhatsapp,
      handleSms,
      handleSharePdf,
    ],
  );

  // 1. حساب حالة التحديد الكلي بشكل منفصل
  const isAllSelected = useMemo(
    () =>
      isBulkMode &&
      selectedIds.size > 0 &&
      selectedIds.size === filteredCustomers.length,
    [isBulkMode, selectedIds.size, filteredCustomers.length],
  );

  // 2. تثبيت دوال الضغط لمنع إتلاف مراجع الأزرار
  const handleOpenForm = useCallback(() => {
    navigation.navigate("CustomerForm");
  }, [navigation]);

  const handleOpenSettings = useCallback(() => {
    setShowTemplateSettings(true);
  }, []);

  const handleEnableBulk = useCallback(() => {
    setIsBulkMode(true);
  }, []);

  // 3. مصفوفة الترويسة الآن مستقرة تماماً أثناء كتابة البحث
  const headerActions = useMemo(() => {
    if (isBulkMode) {
      return [
        {
          icon: isAllSelected ? "check-circle" : "checkbox-blank",
          onPress: toggleSelectAll,
        },
      ];
    }
    return [
      {
        icon: "search",
        onPress: toggleSearch,
      },
      {
        icon: "cog",
        onPress: handleOpenSettings,
      },
      {
        icon: "account-group",
        onPress: handleEnableBulk,
      },
      {
        icon: "plus",
        onPress: handleOpenForm,
      },
    ];
  }, [
    isBulkMode,
    isAllSelected,
    toggleSelectAll,
    toggleSearch,
    handleOpenSettings,
    handleEnableBulk,
    handleOpenForm,
  ]);

  // ✅ السطر المعدل: يمنع إعادة رسم الشاشة بالكامل عند البحث وتحديث القائمة في مكانها بـ FlashList
  if (isLoading && customers.length === 0) {
    return <LoadingOverlay visible />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={isBulkMode ? `تحديد (${selectedIds.size})` : "إدارة العملاء"}
        showBack={isBulkMode}
        onBack={() => {
          setIsBulkMode(false);
          setSelectedIds(new Set());
        }}
        actions={headerActions}
      />

      {/* قسم التحكم العلوي بمساحات متناسقة تماماً */}
      <View style={styles.topControlSection}>
        {/* شريط البحث المدمج والمنسق بدون أي تداخل */}
        {isSearchVisible && (
          <View style={styles.searchBarWrapper}>
            <View style={styles.searchInputContainer}>
              <AppIcon
                name="search"
                size={18}
                color={Colors.neutralText}
                style={styles.searchIcon}
              />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="البحث بالاسم أو رقم الهاتف..."
                placeholderTextColor={Colors.neutralText}
                style={styles.searchInputText}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  hitSlop={8}
                  style={styles.clearBtn}
                >
                  <AppIcon name="close" size={12} color={Colors.neutralText} />
                </Pressable>
              )}
            </View>

            <Pressable style={styles.cancelSearchBtn} onPress={toggleSearch}>
              <Text style={styles.cancelSearchText}>إلغاء</Text>
            </Pressable>
          </View>
        )}

        {/* شريط الفلاتر الكبسولية مع مساحة تفصلها عن البحث */}
        <View style={styles.chipsRow}>
          <Chip
            selected={filterType === "ALL"}
            onPress={() => setFilterType("ALL")}
            icon={() => (
              <AppIcon
                name="users"
                size={14}
                color={
                  filterType === "ALL" ? Colors.onPrimary : Colors.onSurface
                }
              />
            )}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterType === "ALL" ? Colors.primary : Colors.surfaceVariant,
              },
            ]}
            textStyle={{
              color: filterType === "ALL" ? Colors.onPrimary : Colors.onSurface,
              fontSize: 11.5,
              fontWeight: "bold",
            }}
          >
            الكل ({filteredCustomers.length})
          </Chip>

          <Chip
            selected={filterType === "DEBT"}
            onPress={() => setFilterType("DEBT")}
            icon={() => (
              <AppIcon
                name="alert-circle"
                size={14}
                color={
                  filterType === "DEBT" ? Colors.creditRed : Colors.onSurface
                }
              />
            )}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterType === "DEBT"
                    ? Colors.errorBg
                    : Colors.surfaceVariant,
              },
            ]}
            textStyle={{
              color:
                filterType === "DEBT" ? Colors.creditRed : Colors.onSurface,
              fontSize: 11.5,
              fontWeight: "bold",
            }}
          >
            عليها ديون ({statistics.debtorsCount})
          </Chip>

          <Chip
            selected={filterType === "BALANCED"}
            onPress={() => setFilterType("BALANCED")}
            icon={() => (
              <AppIcon name="check-circle" size={14} color={Colors.onSurface} />
            )}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterType === "BALANCED"
                    ? Colors.surface
                    : Colors.surfaceVariant,
              },
            ]}
            textStyle={{
              color: Colors.onSurface,
              fontSize: 11.5,
              fontWeight: "bold",
            }}
          >
            حسابات متوازنة
          </Chip>
        </View>

        {/* شريط الإحصائيات الهادئ والمتباعد */}
        <View style={styles.statsStrip}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>إجمالي الديون المعروضة</Text>
            <Text
              style={[
                styles.statValue,
                { color: Colors.creditRed, writingDirection: "ltr" },
              ]}
            >
              {statistics.totalDebt.toLocaleString("en-US")}{" "}
              <Text style={styles.statCurrency}>ر.ي</Text>
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>عدد المدينين</Text>
            <Text style={[styles.statValue, { color: Colors.onSurface }]}>
              {statistics.debtorsCount}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>العملاء المطابقون</Text>
            <Text style={[styles.statValue, { color: Colors.primary }]}>
              {statistics.totalCustomers}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.listWrapper}>
        <FlashList
          data={paginatedCustomers}
          renderItem={renderCustomerItem}
          keyExtractor={(item: Customer) => item.id}
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            paginatedCustomers.length < filteredCustomers.length ? (
              <ActivityIndicator
                style={{ marginVertical: 8 }}
                color={Colors.primary}
              />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="account-group"
              title="لا يوجد عملاء"
              subtitle="لم يتم العثور على أي نتائج تطابق البحث أو الفلتر"
              actionLabel="إضافة عميل جديد"
              onAction={() => navigation.navigate("CustomerForm")}
            />
          }
        />

        {isBulkMode && selectedIds.size > 0 && (
          <View style={styles.fabContainer}>
            <Button
              mode="contained"
              icon={({ size, color }) => (
                <AppIcon name="sms" size={size} color={color} />
              )}
              onPress={handleSendBulk}
              style={[styles.fab, { backgroundColor: Colors.primary }]}
              labelStyle={styles.fabLabel}
            >
              إرسال لـ {selectedIds.size} عميل
            </Button>
          </View>
        )}
      </View>

      <Portal>
        <Dialog
          visible={showBulkModal}
          onDismiss={() => setShowBulkModal(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            إرسال رسالة جماعية (SMS)
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="نص الرسالة"
              value={bulkMessage}
              onChangeText={setBulkMessage}
              mode="outlined"
              multiline
              numberOfLines={4}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setShowBulkModal(false)}
              textColor={Colors.neutralText}
            >
              إلغاء
            </Button>
            <Button
              mode="contained"
              onPress={executeBulkSend}
              buttonColor={Colors.primary}
            >
              إرسال SMS
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showTemplateSettings}
          onDismiss={() => setShowTemplateSettings(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            إعداد قوالب الرسائل
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.templateHint}>
              المتغيرات المتاحة:{" "}
              <Text style={{ fontWeight: "bold" }}>{"{name}"}</Text> لاسم
              العميل، و{" "}
              <Text style={{ fontWeight: "bold" }}>{"{balance}"}</Text> للرصيد.
            </Text>

            <TextInput
              label="قالب رسائل الواتساب"
              value={whatsappTemplate}
              onChangeText={setWhatsappTemplate}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={{ marginBottom: 10 }}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
            />

            <TextInput
              label="قالب الرسائل النصية (SMS)"
              value={smsTemplate}
              onChangeText={setSmsTemplate}
              mode="outlined"
              multiline
              numberOfLines={3}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="contained"
              onPress={handleSaveTemplates}
              buttonColor={Colors.primary}
            >
              حفظ القوالب
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default CustomerListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topControlSection: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  // 1. شريط البحث المنظم والمحذي للـ RTL
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    marginLeft: 6, // مسافة صحيحة عند بداية الحقل العربي
  },
  searchInputText: {
    flex: 1,
    fontSize: 12.5,
    color: Colors.onSurface,
    paddingVertical: 0,
    textAlign: "right",
  },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  cancelSearchBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelSearchText: {
    fontSize: 12.5,
    fontWeight: "bold",
    color: Colors.primary,
  },

  // 2. الفلاتر الكبسولية
  chipsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  filterChip: {
    height: 30,
    borderRadius: 6,
  },

  // 3. شريط الإحصائيات المدمج
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: Colors.neutralText,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12.5,
    fontWeight: "bold",
  },
  statCurrency: {
    fontSize: 9,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
  },

  // 4. القائمة الرئيسية والأزرار العائمة
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 4,
    paddingBottom: 75,
  },
  fabContainer: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
  },
  fab: {
    borderRadius: 8,
    paddingVertical: 2,
  },
  fabLabel: {
    fontSize: 13.5,
    fontWeight: "bold",
  },

  // 5. النوافذ المنبثقة (Dialogs)
  dialog: {
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  dialogTitle: {
    fontSize: 15.5,
    fontWeight: "bold",
    color: Colors.onSurface,
  },
  templateHint: {
    fontSize: 11.5,
    color: Colors.neutralText,
    marginBottom: 10,
    lineHeight: 16,
  },
});
