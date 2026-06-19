import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GradientButton } from '@/components/ui/gradient-button';
import { PressScale } from '@/components/ui/press-scale';
import { useColors, gradients, radius, shadow, space } from '@/theme/tokens';
import { addByName, runIntake } from '@/engine/intake';
import type { StorageZone } from '@/engine/db';

const ZONES: (StorageZone | 'auto')[] = ['auto', 'fridge', 'pantry', 'freezer'];
const ZONE_LABEL: Record<StorageZone | 'auto', string> = {
  auto: 'Auto', fridge: '🧊 Fridge', pantry: '🥫 Pantry', freezer: '❄️ Freezer',
};

export default function AddScreen() {
  const c = useColors();
  const router = useRouter();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [zone, setZone] = useState<StorageZone | 'auto'>('auto');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const quantity = Math.max(1, parseInt(qty, 10) || 1);
      await addByName(name, quantity, zone === 'auto' ? undefined : zone);
      router.back();
    } catch (e) {
      Alert.alert('Could not add item', String(e));
    } finally {
      setBusy(false);
    }
  };

  const snapReceipt = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera needed', 'Allow camera access to scan receipts.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', base64: true, quality: 0.4 });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    setBusy(true);
    try {
      const out = await runIntake({ imageBase64: res.assets[0].base64 });
      if (out.items.length === 0) Alert.alert('Nothing found', 'Could not read any food items from that photo.');
      else {
        Alert.alert('Added', `Added ${out.items.length} item(s) from your receipt.`);
        router.back();
      }
    } catch (e) {
      Alert.alert('Receipt scan failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [styles.input, { color: c.text, backgroundColor: c.surface }, shadow.card];

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Animated.View entering={FadeInDown.duration(350)} style={{ gap: space.sm }}>
        <Text style={[styles.label, { color: c.textMuted }]}>Item name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Chicken Breast"
          placeholderTextColor={c.textMuted}
          autoFocus
          style={inputStyle}
          onSubmitEditing={submit}
          returnKeyType="done"
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(350)} style={{ gap: space.sm }}>
        <Text style={[styles.label, { color: c.textMuted }]}>Quantity</Text>
        <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" style={inputStyle} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(350)} style={{ gap: space.sm }}>
        <Text style={[styles.label, { color: c.textMuted }]}>Storage zone</Text>
        <View style={styles.zones}>
          {ZONES.map((z) => {
            const active = zone === z;
            return (
              <PressScale
                key={z}
                onPress={() => setZone(z)}
                style={[styles.zone, { backgroundColor: active ? c.primary : c.surface }, shadow.card]}>
                <Text style={[styles.zoneText, { color: active ? c.onPrimary : c.text }]}>{ZONE_LABEL[z]}</Text>
              </PressScale>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: c.textMuted }]}>
          “Auto” uses the built-in food database, or estimates a safe shelf life if unknown.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(350)}>
        <GradientButton
          label={busy ? '' : 'Add to pantry'}
          colors={gradients.primary}
          disabled={!name.trim() || busy}
          onPress={submit}
          icon={busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="add-circle" size={20} color="#fff" />}
        />
      </Animated.View>

      <View style={styles.dividerRow}>
        <View style={[styles.line, { backgroundColor: c.border }]} />
        <Text style={[styles.or, { color: c.textMuted }]}>or</Text>
        <View style={[styles.line, { backgroundColor: c.border }]} />
      </View>

      <Animated.View entering={FadeInDown.delay(240).duration(350)} style={styles.altRow}>
        <PressScale onPress={() => router.push('/scan')} style={[styles.alt, { backgroundColor: c.surface }, shadow.card]}>
          <Ionicons name="barcode-outline" size={26} color={c.primary} />
          <Text style={[styles.altText, { color: c.text }]}>Scan barcode</Text>
        </PressScale>
        <PressScale onPress={snapReceipt} style={[styles.alt, { backgroundColor: c.surface }, shadow.card]}>
          <Ionicons name="receipt-outline" size={26} color={c.primary} />
          <Text style={[styles.altText, { color: c.text }]}>Snap receipt</Text>
        </PressScale>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.xl, gap: space.lg },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderRadius: radius.md, padding: space.lg, fontSize: 16, fontWeight: '600' },
  zones: { flexDirection: 'row', gap: space.sm },
  zone: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.sm },
  zoneText: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 12, fontWeight: '500' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: 1 },
  or: { fontSize: 13, fontWeight: '600' },
  altRow: { flexDirection: 'row', gap: space.md },
  alt: { flex: 1, alignItems: 'center', gap: space.sm, paddingVertical: space.xl, borderRadius: radius.md },
  altText: { fontSize: 14, fontWeight: '700' },
});
