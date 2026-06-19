import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useColors, radius, shadow, space } from '@/theme/tokens';
import { useCountUp } from '@/lib/useCountUp';

export function ZoneCard({
  emoji,
  label,
  count,
  index,
}: {
  emoji: string;
  label: string;
  count: number;
  index: number;
}) {
  const c = useColors();
  const v = useCountUp(count, 600 + index * 100);

  return (
    <Animated.View
      entering={FadeInDown.delay(220 + index * 80).springify().damping(15)}
      style={[styles.card, { backgroundColor: c.surface }, shadow.card]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.count, { color: c.text }]}>{v}</Text>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.md, padding: space.lg, alignItems: 'center', gap: 2 },
  emoji: { fontSize: 24, marginBottom: space.xs },
  count: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '600' },
});
