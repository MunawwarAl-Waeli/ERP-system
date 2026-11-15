import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme, IconButton, Avatar } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface CustomerCardProps {
  name: string;
  phone?: string;
  outstandingCredit?: number;
  onPress: () => void;
  onCall?: () => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  name,
  phone,
  outstandingCredit = 0,
  onPress,
  onCall,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("customers");
  const firstLetter = name ? name.charAt(0).toUpperCase() : "?";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.contentRow}>
        <Avatar.Text
          size={48}
          label={firstLetter}
          style={{ backgroundColor: theme.colors.primaryContainer }}
          color={theme.colors.primary}
        />
        
        <View style={styles.infoContainer}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }} numberOfLines={1}>
            {name}
          </Text>
          {phone ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {phone}
            </Text>
          ) : null}
          
          <View style={styles.balanceRow}>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("totalRequired", "المطلوب")}: 
            </Text>
            <Text
              variant="titleSmall"
              style={{
                color: outstandingCredit > 0 ? theme.colors.error : theme.colors.primary,
                fontWeight: "bold",
                marginLeft: 4,
              }}
            >
              {outstandingCredit > 0 ? outstandingCredit.toLocaleString() : "0"}
            </Text>
          </View>
        </View>

        {onCall && phone ? (
          <IconButton
            icon="phone"
            size={20}
            iconColor={theme.colors.primary}
            onPress={onCall}
            style={{ margin: 0 }}
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    padding: 12,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
});
