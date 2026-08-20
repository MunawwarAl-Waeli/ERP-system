/* eslint-disable no-nested-ternary */
/* eslint-disable complexity */
import React, { useState, useCallback, memo } from "react";
import { View, StyleSheet, TouchableOpacity, I18nManager } from "react-native";
import {
  Text,
  useTheme,
  IconButton,
  ActivityIndicator,
} from "react-native-paper";
import { StatusBadge } from "@shared/components/StatusBadge";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { ChartOfAccount } from "@core/database";
import { useAccountChildren } from "../hooks/useAccountingData";

interface AccountTreeNodeProps {
  account: ChartOfAccount;
  depth?: number;
  onEdit: (account: ChartOfAccount) => void;
  onAddSub: (parentAccount: ChartOfAccount) => void;
}

export const AccountTreeNode: React.FC<AccountTreeNodeProps> = memo(
  ({ account, depth = 0, onEdit, onAddSub }) => {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(depth < 1);
    const { children, isLoading } = useAccountChildren(account.id, expanded);

    const hasChildren = children.length > 0;
    const isRTL = I18nManager.isRTL;

    const toggleExpand = useCallback(() => {
      if (hasChildren) {
        setExpanded((prev) => !prev);
      }
    }, [hasChildren]);

    // تحديد خلفية السطر حسب المستويات لزيادة التسلسل البصري
    const rowBackground =
      depth === 0
        ? theme.colors.elevation?.level1 || theme.colors.surfaceVariant
        : theme.colors.surface;

    // تحديد أيقونة التوسيع بناءً على الاتجاه RTL / LTR
    const expandIcon = expanded
      ? "chevron-down"
      : isRTL
      ? "chevron-left"
      : "chevron-right";

    return (
      <View style={styles.container}>
        <View
          style={[
            styles.row,
            {
              paddingStart: depth * 16 + 12, // دعم التباعد الجانبي التكيفي مع RTL
              backgroundColor: rowBackground,
              borderBottomColor:
                theme.colors.outlineVariant || "rgba(0,0,0,0.06)",
            },
          ]}
        >
          {/* expand / collapse icon */}
          <TouchableOpacity
            style={styles.expandTouchable}
            onPress={toggleExpand}
            disabled={!hasChildren}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} // زيادة مساحة اللمس
          >
            {isLoading ? (
              <ActivityIndicator size={16} color={theme.colors.primary} />
            ) : hasChildren ? (
              <AppIcon
                name={expandIcon}
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            ) : (
              <View style={styles.expandPlaceholder} />
            )}
          </TouchableOpacity>

          {/* Account Code Badge */}
          <View
            style={[
              styles.codeContainer,
              {
                backgroundColor:
                  theme.colors.primaryContainer || "rgba(0,0,0,0.04)",
              },
            ]}
          >
            <Text
              variant="labelMedium"
              style={[
                styles.codeText,
                {
                  color:
                    theme.colors.onPrimaryContainer || theme.colors.primary,
                },
              ]}
            >
              {account.code}
            </Text>
          </View>

          {/* Account Details */}
          <TouchableOpacity
            style={styles.detailsContainer}
            onPress={toggleExpand}
            activeOpacity={hasChildren ? 0.7 : 1}
          >
            <View style={styles.nameRow}>
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.accountName,
                  {
                    fontWeight: depth === 0 ? "700" : "500",
                    color: theme.colors.onSurface,
                  },
                ]}
              >
                {account.name}
              </Text>

              {account.isCashAccount && (
                <StatusBadge label="نقدي" type="info" compact />
              )}
            </View>
          </TouchableOpacity>

          {/* Actions */}
          <View style={styles.actions}>
            <IconButton
              icon={paperIcon("plus-circle")}
              size={18}
              iconColor={theme.colors.primary}
              style={styles.actionButton}
              onPress={() => onAddSub(account)}
            />
            <IconButton
              icon={paperIcon("pencil-outline")}
              size={18}
              iconColor={theme.colors.onSurfaceVariant}
              style={styles.actionButton}
              onPress={() => onEdit(account)}
            />
          </View>
        </View>

        {/* Children Sub-Tree */}
        {hasChildren && expanded && (
          <View style={styles.childrenContainer}>
            {children.map((child) => (
              <AccountTreeNode
                key={child.id}
                account={child}
                depth={depth + 1}
                onEdit={onEdit}
                onAddSub={onAddSub}
              />
            ))}
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingEnd: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48, // ارتفاع مريح وموحد للمس
  },
  expandTouchable: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 4,
  },
  expandPlaceholder: {
    width: 20,
  },
  codeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginEnd: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  codeText: {
    fontWeight: "700",
    fontSize: 12,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "nowrap",
  },
  accountName: {
    flexShrink: 1, // لمنع قص شارة "نقدي" عند اسم الحساب الطويل
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginStart: 4,
  },
  actionButton: {
    margin: 0, // إزالة الهوامش الزائدة من React Native Paper لتوفير المساحة
  },
  childrenContainer: {
    width: "100%",
  },
});
