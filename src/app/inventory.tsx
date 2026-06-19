import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ItemCard } from '@/components/ui/item-card';
import { PressScale } from '@/components/ui/press-scale';
import { SwipeToDelete } from '@/components/ui/swipe-to-delete';
import { useColors, font, radius, shadow, space } from '@/theme/tokens';
import { deleteItem, getAllItems, type InventoryItem, type StorageZone } from '@/engine/db';
import { scheduleExpiryNotifications } from '@/engine/notifications';

const FILTERS: ('all' | StorageZone)[] = ['all', 'fridge', 'pantry', 'freezer'];
const LABELS: Record<'all' | StorageZone, string> = {
  all: 'All',
  fridge: '🧊 Fridge',
  pantry: '🥫 Pantry',
  freezer: '❄️ Freezer',
};

export default function Inventory() {
  const c = useColors();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState<'all' | StorageZone>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    getAllItems().then(setItems).catch((e) => console.error(e));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = items
    .filter((i) => filter === 'all' || i.storage_zone === filter)
    .filter((i) => !search.trim() || i.normalized_name.toLowerCase().includes(search.trim().toLowerCase()));

  const doDelete = async (id: string) => {
    await deleteItem(id);
    await scheduleExpiryNotifications();
    load();
  };

  const confirmDelete = (id: string, name: string) =>
    Alert.alert('Remove item', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => doDelete(id) },
    ]);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            {/* Search bar */}
            <View style={[styles.searchBar, { backgroundColor: c.surface }, shadow.card]}>
              <Ionicons name="search" size={18} color={c.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search items…"
                placeholderTextColor={c.textMuted}
                style={[styles.searchInput, { color: c.text }]}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <PressScale onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={c.textMuted} />
                </PressScale>
              )}
            </View>
            {/* Zone filter chips */}
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
          </View>
        }
        renderItem={({ item, index }) => (
          <SwipeToDelete onDelete={() => doDelete(item.id)}>
            <ItemCard
              item={item}
              index={index}
              onPress={() => router.push({ pathname: '/edit', params: { id: item.id } })}
              onLongPress={() => confirmDelete(item.id, item.normalized_name)}
            />
          </SwipeToDelete>
        )}
        ListFooterComponent={
          shown.length > 0 ? (
            <Text style={[styles.hint, { color: c.textMuted }]}>Swipe left or long-press to remove an item.</Text>
          ) : null
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textMuted }]}>
            {search.trim() ? 'No items match your search.' : 'Nothing here yet.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: space.xl, gap: space.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  searchInput: { flex: 1, paddingVertical: space.md, fontSize: 15, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xs },
  chip: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  chipText: { fontSize: 13, fontFamily: font.semibold },
  hint: { textAlign: 'center', fontSize: 12, marginTop: space.md },
  empty: { textAlign: 'center', marginTop: space.xxxl, fontSize: 15 },
});
