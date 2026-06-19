import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ItemCard } from '@/components/ui/item-card';
import { PressScale } from '@/components/ui/press-scale';
import { useColors, radius, shadow, space } from '@/theme/tokens';
import { deleteItem, getAllItems, type InventoryItem, type StorageZone } from '@/engine/db';

const FILTERS: ('all' | StorageZone)[] = ['all', 'fridge', 'pantry', 'freezer'];
const LABELS: Record<'all' | StorageZone, string> = {
  all: 'All',
  fridge: '🧊 Fridge',
  pantry: '🥫 Pantry',
  freezer: '❄️ Freezer',
};

export default function Inventory() {
  const c = useColors();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState<'all' | StorageZone>('all');

  const load = useCallback(() => {
    getAllItems().then(setItems).catch((e) => console.error(e));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = filter === 'all' ? items : items.filter((i) => i.storage_zone === filter);

  const del = (id: string, name: string) =>
    Alert.alert('Remove item', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteItem(id).then(load) },
    ]);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.chips}>
            {FILTERS.map((f) => {
              const active = filter === f;
              return (
                <PressScale
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.chip, { backgroundColor: active ? c.primary : c.surface }, shadow.card]}>
                  <Text style={[styles.chipText, { color: active ? c.onPrimary : c.textMuted }]}>{LABELS[f]}</Text>
                </PressScale>
              );
            })}
          </View>
        }
        renderItem={({ item, index }) => (
          <ItemCard item={item} index={index} onLongPress={() => del(item.id, item.normalized_name)} />
        )}
        ListFooterComponent={
          shown.length > 0 ? (
            <Text style={[styles.hint, { color: c.textMuted }]}>Long-press an item to remove it.</Text>
          ) : null
        }
        ListEmptyComponent={<Text style={[styles.empty, { color: c.textMuted }]}>Nothing here yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: space.xl, gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  chip: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  chipText: { fontSize: 13, fontWeight: '700' },
  hint: { textAlign: 'center', fontSize: 12, marginTop: space.md },
  empty: { textAlign: 'center', marginTop: space.xxxl, fontSize: 15 },
});
