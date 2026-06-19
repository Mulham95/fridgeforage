import { StyleSheet, Text, View } from 'react-native';

import { PressScale } from './press-scale';
import { useColors, font, space } from '@/theme/tokens';

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {actionLabel && onAction && (
        <PressScale onPress={onAction}>
          <Text style={[styles.action, { color: c.primary }]}>{actionLabel}</Text>
        </PressScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
    marginTop: space.sm,
  },
  title: { fontSize: 19, fontFamily: font.bold, letterSpacing: -0.2 },
  action: { fontSize: 14, fontFamily: font.semibold },
});
