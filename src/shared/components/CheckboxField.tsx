import React from 'react';
import { TouchableOpacity, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { AppIcon } from './Icon';

interface CheckboxFieldProps {
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export const CheckboxField: React.FC<CheckboxFieldProps> = ({ checked, onPress, disabled, style }) => {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.container, style]}
    >
      <AppIcon
        name={checked ? 'check' : 'square'}
        size={24}
        color={checked ? theme.colors.primary : theme.colors.onSurfaceVariant}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 4,
  },
});