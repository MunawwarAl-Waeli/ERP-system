import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { AppIcon } from "@shared/components/Icon";
import { CurrencyText } from "@shared/components/CurrencyText";
import { useTranslation } from "react-i18next";

interface AccountSummaryCardsProps {
  totals: {
    assets: number;
    liabilities: number;
    equity: number;
    revenue: number;
    expenses: number;
  };
}

export const AccountSummaryCards: React.FC<AccountSummaryCardsProps> = ({
  totals,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("accounting");

  const cards = [
    {
      title: t("assets"),
      amount: totals.assets,
      icon: "landmark",
      bgColor: theme.colors.primaryContainer,
      iconColor: theme.colors.onPrimaryContainer,
    },
    {
      title: t("liabilities"),
      amount: totals.liabilities,
      icon: "scale",
      bgColor: theme.colors.errorContainer,
      iconColor: theme.colors.onErrorContainer,
    },
    {
      title: t("equity"),
      amount: totals.equity,
      icon: "shield",
      bgColor: theme.colors.tertiaryContainer,
      iconColor: theme.colors.onTertiaryContainer,
    },
    {
      title: t("revenue"),
      amount: totals.revenue,
      icon: "trending-up",
      bgColor: theme.colors.secondaryContainer,
      iconColor: theme.colors.onSecondaryContainer,
    },
    {
      title: t("expense"),
      amount: totals.expenses,
      icon: "trending-down",
      bgColor: theme.colors.surfaceVariant,
      iconColor: theme.colors.onSurfaceVariant,
    },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContainer}
    >
      {cards.map((item) => (
        <Card
          key={item.title}
          style={[styles.card, { backgroundColor: theme.colors.surface }]}
          mode="elevated"
        >
          <Card.Content style={styles.cardContent}>
            <View
              style={[styles.iconContainer, { backgroundColor: item.bgColor }]}
            >
              <AppIcon name={item.icon} size={20} color={item.iconColor} />
            </View>
            <View style={styles.info}>
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {item.title}
              </Text>
              <CurrencyText
                amount={item.amount}
                variant="titleMedium"
                colored={item.amount !== 0} // تلوين تلقائي (أخضر/أحمر) حسب القيمة
              />
            </View>
          </Card.Content>
        </Card>
      ))} 
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  card: {
    minWidth: 140,
    borderRadius: 12,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    justifyContent: "center",
  },
});