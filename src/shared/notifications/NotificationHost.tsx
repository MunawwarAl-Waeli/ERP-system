import React, { useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { Portal, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@shared/components/Icon";
import { useNotificationStore } from "./notificationStore";
import { NotificationType } from "./types";

const TYPE_CONFIG: Record<
  NotificationType,
  { bg: string; icon: string; accent: string; text: string }
> = {
  success: { bg: "#ECFDF5", icon: "check-circle", accent: "#16A34A", text: "#065F46" },
  error:   { bg: "#FEF2F2", icon: "alert-circle", accent: "#DC2626", text: "#991B1B" },
  warning: { bg: "#FFFBEB", icon: "alert-triangle", accent: "#D97706", text: "#92400E" },
  info:    { bg: "#EFF6FF", icon: "info", accent: "#2563EB", text: "#1E40AF" },
};

const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  success: 3000,
  info: 3500,
  warning: 4000,
  error: 5000,
};

const HIDDEN_OFFSET = -140;
const ANIMATION_DURATION = 220;

export const NotificationHost: React.FC = () => {
  const current = useNotificationStore((s) => s.current);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(HIDDEN_OFFSET)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animateOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: HIDDEN_OFFSET,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      translateY.setValue(HIDDEN_OFFSET);
      opacity.setValue(0);
      dismiss();
    });
  }, [dismiss, opacity, translateY]);

  useEffect(() => {
    if (!current) return;

    translateY.setValue(HIDDEN_OFFSET);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 11,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const duration =
      current.duration ??
      (current.action ? 6000 : DEFAULT_DURATIONS[current.type]);

    if (duration > 0) {
      const timer = setTimeout(animateOut, duration);
      return () => clearTimeout(timer);
    }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;

  const config = TYPE_CONFIG[current.type];

  return (
    <Portal>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.wrapper,
          {
            paddingTop: insets.top + 10,
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: config.bg,
              borderRightColor: config.accent,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: config.accent }]}>
            <AppIcon name={config.icon} size={18} color="#FFFFFF" />
          </View>

          <Text
            style={[styles.message, { color: config.text }]}
            numberOfLines={4}
          >
            {current.message}
          </Text>

          {current.action ? (
            <TouchableOpacity
              onPress={() => {
                current.action!.onPress();
                animateOut();
              }}
              style={styles.actionBtn}
              activeOpacity={0.6}
            >
              <Text style={[styles.actionText, { color: config.accent }]}>
                {current.action.label}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={animateOut}
            style={styles.closeBtn}
            hitSlop={10}
            activeOpacity={0.6}
          >
            <AppIcon name="close" size={16} color={config.text} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Portal>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    zIndex: 9999,
    elevation: 999,
  },
  container: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRightWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  message: {
    flex: 1,
    fontSize: 14,
    textAlign: "right",
    fontWeight: "500",
    lineHeight: 20,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
});
