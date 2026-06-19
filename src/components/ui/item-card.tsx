import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PressScale } from './press-scale';
import { useColors, font, radius, shadow, space } from '@/theme/tokens';
import { daysLeft, expiryColor, expiryLabel, ZONE_META } from '@/lib/expiry';
import type { InventoryItem } from '@/engine/db';

/** Full-width pantry list row. */
export function ItemCard({
  item,
  index,
  onPress,
  onLongPress,
}: {
  item: InventoryItem;
  index: number;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const c = useColors();
  const d = daysLeft(item.expires_at);
  const color = expiryColor(d);
  const zone = ZONE_META[item.storage_zone];

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(16)}>
      <PressScale
        onPress={onPress}
        onLongPress={onLongPress}
        style={[styles.row, { backgroundColor: c.surface }, shadow.card]}>
        <View style={[styles.accent, { backgroundColor: color }]} />
        <View style={styles.body}>
          <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>
            {item.normalized_name}
          </Text>
          <Text style={[styles.sub, { color: c.textMuted }]} numberOfLines={1}>
            {zone?.emoji} {zone?.label} · {item.quantity} {item.unit}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: color + '1A' }]}>
          <Text style={[styles.badgeText, { color }]}>{expiryLabel(d)}</Text>
        </View>
      </PressScale>
    </Animated.View>
  );
}

/** Compact card for the horizontal "expiring soon" carousel. */
export function ExpiringCard({ item, index, onPress }: { item: InventoryItem; index: number; onPress?: () => void }) {
  const c = useColors();
  const d = daysLeft(item.expires_at);
  const color = expiryColor(d);
  const zone = ZONE_META[item.storage_zone];

  return (
    <Animated.View entering={FadeInDown.delay(120 + index * 70).springify().damping(15)}>
      <PressScale onPress={onPress} style={[styles.compact, { backgroundColor: c.surface }, shadow.card]}>
        <View style={[styles.compactTop, { backgroundColor: color + '1A' }]}>
          <Text style={[styles.compactDays, { color }]}>{d <= 0 ? '!' : d}</Text>
          <Text style={[styles.compactDaysLabel, { color }]}>{d <= 0 ? 'today' : d === 1 ? 'day' : 'days'}</Text>
        </View>
        <Text numberOfLines={2} style={[styles.compactName, { color: c.text }]}>
          {item.normalized_name}
        </Text>
        <Text style={[styles.compactZone, { color: c.textMuted }]}>
          {zone?.emoji} {zone?.label}
        </Text>
      </PressScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
    overflow: 'hidden',
  },
  accent: { width: 5, alignSelf: 'stretch', borderRadius: 3, marginVertical: -space.lg, marginLeft: -space.lg + 4 },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontFamily: font.semibold },
  sub: { fontSize: 13, fontWeight: '500' },
  badge: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontFamily: font.bold },

  compact: { width: 132, borderRadius: radius.md, padding: space.md, gap: space.xs },
  compactTop: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  compactDays: { fontSize: 22, fontFamily: font.bold, lineHeight: 24 },
  compactDaysLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  compactName: { fontSize: 14, fontFamily: font.semibold },
  compactZone: { fontSize: 12, fontWeight: '500' },
});
