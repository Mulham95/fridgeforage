import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteItem, getAllItems, type InventoryItem } from '@/engine/db';
import { daysLeft, expiryColor, expiryLabel, ZONE_META } from '@/lib/expiry';

export default function PantryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);

  const load = useCallback(() => {
    getAllItems().then(setItems).catch((e) => console.error(e));
  }, []);

  // Reload every time the screen regains focus (after add/scan/delete).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = (item: InventoryItem) => {
    Alert.alert('Remove item', `Remove "${item.normalized_name}" from your pantry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteItem(item.id).then(load),
      },
    ]);
  };

  const expiringSoon = items.filter((i) => daysLeft(i.expires_at) <= 2).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        {expiringSoon > 0 && (
          <Pressable onPress={() => router.push('/recipe')}>
            <View style={[styles.banner, { backgroundColor: '#F76808' }]}>
              <ThemedText style={styles.bannerText}>
                ⚠️ {expiringSoon} item{expiringSoon > 1 ? 's' : ''} expiring soon — tap to cook
              </ThemedText>
            </View>
          </Pressable>
        )}

        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText type="subtitle" style={styles.emptyTitle}>
                Your pantry is empty
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
                Tap ＋ to add groceries, scan a barcode, or snap a receipt.
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => {
            const d = daysLeft(item.expires_at);
            const zone = ZONE_META[item.storage_zone];
            return (
              <Pressable onLongPress={() => onDelete(item)}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <View style={[styles.dot, { backgroundColor: expiryColor(d) }]} />
                  <View style={styles.cardBody}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {item.normalized_name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {zone?.emoji} {zone?.label} · {item.quantity} {item.unit}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: expiryColor(d), fontWeight: '700' }}>
                    {expiryLabel(d)}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          }}
        />

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, { backgroundColor: theme.backgroundSelected }]}
            onPress={() => router.push('/recipe')}>
            <ThemedText type="smallBold">🍳 Cook</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnPrimary, { backgroundColor: '#208AEF' }]}
            onPress={() => router.push('/add')}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>＋ Add item</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  banner: { margin: Spacing.three, padding: Spacing.three, borderRadius: Spacing.two },
  bannerText: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.two, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cardBody: { flex: 1, gap: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  emptyTitle: { textAlign: 'center' },
  emptyHint: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three },
  btn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.three },
  btnPrimary: { flex: 2 },
});
