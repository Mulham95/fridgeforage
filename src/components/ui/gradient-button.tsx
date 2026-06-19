import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PressScale } from './press-scale';
import { radius, shadow, space } from '@/theme/tokens';

type Props = {
  label: string;
  colors: readonly [string, string, ...string[]];
  onPress?: () => void;
  icon?: ReactNode;
  full?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function GradientButton({ label, colors, onPress, icon, full, disabled, style }: Props) {
  return (
    <PressScale onPress={onPress} disabled={disabled} style={[full ? { flex: 1 } : null, style]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.grad, shadow.card, disabled && { opacity: 0.5 }]}>
        {icon}
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  grad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
  },
  label: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
