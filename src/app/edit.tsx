import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GradientButton } from '@/components/ui/gradient-button';
import { PressScale } from '@/components/ui/press-scale';
import { useColors, gradients, radius, shadow, space, palette } from '@/theme/tokens';
import { getItem, updateItem, deleteItem, type InventoryItem, type StorageZone } from '@/engine/db';
import { scheduleExpiryNotifications } from '@/engine/notifications';
import { daysLeft, expiryColor, expiryLabel } from '@/lib/expiry';

const ZONES: StorageZone[] = ['fridge', 'pantry', 'freezer'];
const ZONE_LABEL: Record<StorageZone, string> = {
  fridge: '🧊 Fridge',
  pantry: '🥫 Pantry',
  freezer: '❄️ Freezer',
};
const UNITS = ['pcs', 'bag', 'box', 'can', 'bottle', 'lbs', 'oz', 'g', 'kg', 'ml', 'l', 'bunch', 'dozen'];

export default function EditScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [zone, setZone] = useState<StorageZone>('fridge');
  const [shelfDays, setShelfDays] = useState('7');

  useEffect(() => {
    if (!id) return;
    getItem(id).then((it) => {
      if (!it) {
        Alert.alert('Not found', 'This item was already removed.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      setItem(it);
      setName(it.normalized_name);
      setQty(String(it.quantity));
      setUnit(it.unit);
      setZone(it.storage_zone);
      setShelfDays(String(it.estimated_shelf_life_days));
      setLoading(false);
    });
  }, [id, router]);

  const save = async () => {
    if (!id || !name.trim()) return;
    setSaving(true);
    try {
      const quantity = Math.max(1, parseInt(qty, 10) || 1);
      const days = Math.max(1, parseInt(shelfDays, 10) || 7);
      await updateItem(id, {
        normalized_name: name.trim(),
        quantity,
        unit,
        storage_zone: zone,
        estimated_shelf_life_days: days,
      });
      await scheduleExpiryNotifications();
      router.back();
    } catch (e) {
      Alert.alert('Could not save', String(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!id) return;
    Alert.alert('Remove item', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteItem(id);
          await scheduleExpiryNotifications();
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  const d = item ? daysLeft(item.expires_at) : 0;
  const color = expiryColor(d);
  const inputStyle = [styles.input, { color: c.text, backgroundColor: c.surface }, shadow.card];

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      {/* ---- Expiry status badge ---- */}
      <Animated.View
        entering={FadeInDown.duration(350)}
        style={[styles.statusCard, { backgroundColor: color + '1A' }]}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusText, { color }]}>{expiryLabel(d)}</Text>
      </Animated.View>

      {/* ---- Name ---- */}
      <Animated.View entering={FadeInDown.delay(60).duration(350)} style={{ gap: space.sm }}>
        <Text style={[styles.label, { color: c.textMuted }]}>Item name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Chicken Breast"
          placeholderTextColor={c.textMuted}
          style={inputStyle}
          returnKeyType="done"
        />
      </Animated.View>

      {/* ---- Quantity + Unit row ---- */}
      <Animated.View entering={FadeInDown.delay(120).duration(350)} style={{ gap: space.sm }}>
        <Text style={[styles.label, { color: c.textMuted }]}>Quantity & unit</Text>
        <View style={styles.qtyRow}>
          <TextInput
            value={qty}
            onChangeText={setQty}
            keyboardType="number-pad"
            style={[inputStyle, styles.qtyInput]}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.unitChips}>
            {UNITS.map((u) => {
              const active = unit === u;
              return (
                <PressScale
                  key={u}
                  onPress={() => setUnit(u)}
                  style={[styles.unitChip, { backgroundColor: active ? c.primary : c.surface }, shadow.card]}>
                  <Text style={[styles.unitText, { color: active ? c.onPrimary : c.textMuted }]}>{u}</Text>
                </PressScale>
              );
            })}
          </ScrollView>
        </View>
      </Animated.View>

      {/* ---- Storage zone ---- */}
      <Animated.View entering={FadeInDown.delay(180).duration(350)} style={{ gap: space.sm }}>
        <Text style={[styles.label, { color: c.textMuted }]}>Storage zone</Text>
        <View style={styles.zones}>
          {ZONES.map((z) => {
            const active = zone === z;
            return (
              <PressScale
                key={z}
                onPress={() => setZone(z)}
                style={[styles.zone, { backgroundColor: active ? c.primary : c.surface }, shadow.card]}>
                <Text style={[styles.zoneText, { color: active ? c.onPrimary : c.text }]}>
                  {ZONE_LABEL[z]}
                </Text>
              </PressScale>
            );
          })}
        </View>
      </Animated.View>

      {/* ---- Shelf life ---- */}
      <Animated.View entering={FadeInDown.delay(240).duration(350)} style={{ gap: space.sm }}>
        <Text style={[styles.label, { color: c.textMuted }]}>Shelf life (days)</Text>
        <View style={styles.shelfRow}>
          <PressScale
            onPress={() => setShelfDays(String(Math.max(1, (parseInt(shelfDays, 10) || 1) - 1)))}
            style={[styles.stepBtn, { backgroundColor: c.surface }, shadow.card]}>
            <Ionicons name="remove" size={20} color={c.text} />
          </PressScale>
          <TextInput
            value={shelfDays}
            onChangeText={setShelfDays}
            keyboardType="number-pad"
            style={[inputStyle, styles.shelfInput]}
          />
          <PressScale
            onPress={() => setShelfDays(String((parseInt(shelfDays, 10) || 0) + 1))}
            style={[styles.stepBtn, { backgroundColor: c.surface }, shadow.card]}>
            <Ionicons name="add" size={20} color={c.text} />
          </PressScale>
        </View>
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Days from when the item was added. Changing this recomputes the expiry date.
        </Text>
      </Animated.View>

      {/* ---- Save ---- */}
      <Animated.View entering={FadeInDown.delay(300).duration(350)}>
        <GradientButton
          label={saving ? '' : 'Save changes'}
          colors={gradients.primary}
          disabled={!name.trim() || saving}
          onPress={save}
          icon={
            saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
            )
          }
        />
      </Animated.View>

      {/* ---- Delete ---- */}
      <Animated.View entering={FadeInDown.delay(360).duration(350)}>
        <PressScale onPress={confirmDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={palette.red} />
          <Text style={[styles.deleteText, { color: palette.red }]}>Remove this item</Text>
        </PressScale>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: space.xl, gap: space.lg },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderRadius: radius.md, padding: space.lg, fontSize: 16, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  qtyInput: { width: 72, textAlign: 'center' },
  unitChips: { gap: space.xs, paddingRight: space.sm },
  unitChip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill },
  unitText: { fontSize: 12, fontWeight: '700' },
  zones: { flexDirection: 'row', gap: space.sm },
  zone: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.sm },
  zoneText: { fontSize: 13, fontWeight: '700' },
  shelfRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelfInput: { flex: 1, textAlign: 'center' },
  hint: { fontSize: 12, fontWeight: '500' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
  },
  deleteText: { fontSize: 15, fontWeight: '700' },
});
