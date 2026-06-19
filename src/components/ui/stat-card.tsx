import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useColors, font, radius, shadow, space } from '@/theme/tokens';
import { useCountUp } from '@/lib/useCountUp';

type Props = {
  label: string;
  value: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  index: number;
};

export function StatCard({ label, value, color, icon, index }: Props) {
  const c = useColors();
  const v = useCountUp(value, 650 + index * 120);

  return (
    <Animated.View
      entering={FadeInDown.delay(150 + index * 80).springify().damping(15)}
      style={[styles.card, { backgroundColor: c.surface }, shadow.card]}>
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.value, { color: c.text }]}>{v}</Text>
      <Text style={[styles.label, { color: c.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  value: { fontSize: 26, fontFamily: font.bold },
  label: { fontSize: 12, fontFamily: font.medium },
});
