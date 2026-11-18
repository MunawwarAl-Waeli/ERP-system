import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Text, Surface, Checkbox } from "react-native-paper";
import { AppIcon } from "src/shared/components/Icon";
import { Colors } from "src/core/theme/colors";

interface CustomerCardProps {
  name: string;
  phone?: string;
  outstandingCredit?: number;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onPress: () => void;
  onCall?: () => void;
  onWhatsapp?: () => void;
  onSms?: () => void;
  onPdf?: () => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = React.memo(
  ({
    name,
    phone,
    outstandingCredit = 0,
    isSelectionMode = false,
    isSelected = false,
    onPress,
    onCall,
    onWhatsapp,
    onSms,
    onPdf,
  }) => {
    const hasDebt = outstandingCredit > 0;
    const hasAdvance = outstandingCredit < 0;
    const isBalanced = outstandingCredit === 0;

    const formattedBalance = outstandingCredit.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    const avatarLetter = name.trim().charAt(0) || "ع";

    return (
      <Surface
        style={[
          styles.card,
          {
            backgroundColor: Colors.surface,
            borderColor: isSelected ? Colors.primary : Colors.border,
            borderWidth: isSelected ? 1.5 : 1,
          },
        ]}
        elevation={0}
      >
        <Pressable
          onPress={onPress}
          android_ripple={{ color: "rgba(0,0,0,0.03)" }}
          style={styles.cardInner}
        >
          {/* الصف الرئيسي */}
          <View style={styles.topRow}>
            {isSelectionMode && (
              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={isSelected ? "checked" : "unchecked"}
                  onPress={onPress}
                  color={Colors.primary}
                />
              </View>
            )}

            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: hasDebt
                    ? Colors.errorBg
                    : Colors.surfaceVariant,
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  {
                    color: hasDebt ? Colors.creditRed : Colors.onSurfaceVariant,
                  },
                ]}
              >
                {avatarLetter}
              </Text>
            </View>

            <View style={styles.infoCol}>
              <Text
                style={[styles.customerName, { color: Colors.onSurface }]}
                numberOfLines={1}
              >
                {name}
              </Text>
              {phone ? (
                <View style={styles.phoneRow}>
                  <AppIcon
                    name="phone"
                    size={12}
                    color={Colors.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.phoneText,
                      {
                        color: Colors.onSurfaceVariant,
                        writingDirection: "ltr",
                      },
                    ]}
                  >
                    {phone}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.noPhoneText, { color: Colors.neutralText }]}
                >
                  بدون رقم
                </Text>
              )}
            </View>

            {/* شارة الرصيد */}

            <View
              style={[
                styles.badge,
                {
                  backgroundColor: hasDebt
                    ? Colors.errorBg
                    : hasAdvance
                    ? Colors.successBg || "#E8F5E9"
                    : Colors.surfaceVariant,
                  borderColor: hasDebt
                    ? Colors.errorLight
                    : hasAdvance
                    ? Colors.successLight || "#A5D6A7"
                    : Colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeLabel,
                  {
                    color: hasDebt
                      ? Colors.creditRed
                      : hasAdvance
                      ? Colors.paymentGreen || "#2E7D32"
                      : Colors.neutralText,
                  },
                ]}
              >
                {hasDebt
                  ? "مستحق عليه"
                  : hasAdvance
                  ? "له رصيد مقدم"
                  : "متوازن"}
              </Text>

              {!isBalanced && (
                <Text
                  style={[
                    styles.badgeValue,
                    {
                      color: hasDebt
                        ? Colors.creditRed
                        : Colors.paymentGreen || "#2E7D32",
                      writingDirection: "ltr",
                    },
                  ]}
                >
                  {formattedBalance} <Text style={styles.currency}>ر.ي</Text>
                </Text>
              )}
            </View>
          </View>

          {/* شريط الإجراءات */}
          <View style={styles.bottomRow}>
            <View style={styles.actionsGroup}>
              <Pressable
                style={styles.miniActionBtn}
                onPress={onCall}
                disabled={!phone}
              >
                <AppIcon
                  name="phone"
                  size={15}
                  color={phone ? Colors.onSurfaceVariant : Colors.neutralText}
                />
              </Pressable>

              <Pressable style={styles.miniActionBtn} onPress={onWhatsapp}>
                <AppIcon
                  name="whatsapp"
                  size={15}
                  color={Colors.onSurfaceVariant}
                />
              </Pressable>

              <Pressable style={styles.miniActionBtn} onPress={onSms}>
                <AppIcon name="sms" size={15} color={Colors.onSurfaceVariant} />
              </Pressable>

              <Pressable style={styles.miniActionBtn} onPress={onPdf}>
                <AppIcon
                  name="file-pdf-box"
                  size={15}
                  color={Colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Surface>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  cardInner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxContainer: {
    marginRight: -4,
    marginLeft: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  infoCol: {
    flex: 1,
    marginHorizontal: 10,
    alignItems: "flex-start",
  },
  customerName: {
    fontSize: 14.5,
    fontWeight: "700",
    marginBottom: 2,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: "500",
  },
  noPhoneText: {
    fontSize: 11,
    fontStyle: "italic",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 72,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  badgeValue: {
    fontSize: 12.5,
    fontWeight: "bold",
  },
  currency: {
    fontSize: 9.5,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceVariant,
  },
  actionsGroup: {
    flexDirection: "row",
    gap: 8,
  },
  miniActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: Colors.surfaceVariant,
    justifyContent: "center",
    alignItems: "center",
  },
});
