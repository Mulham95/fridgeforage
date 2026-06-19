import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addByName, runIntake } from '@/engine/intake';
import type { StorageZone } from '@/engine/db';

const ZONES: (StorageZone | 'auto')[] = ['auto', 'fridge', 'pantry', 'freezer'];

export default function AddScreen() {
  const theme = useTheme();
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
      if (out.items.length === 0) {
        Alert.alert('Nothing found', 'Could not read any food items from that photo.');
      } else {
        Alert.alert('Added', `Added ${out.items.length} item(s) from your receipt.`);
        router.back();
      }
    } catch (e) {
      Alert.alert('Receipt scan failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">Item name</ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Chicken Breast"
        placeholderTextColor={theme.textSecondary}
        autoFocus
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        onSubmitEditing={submit}
        returnKeyType="done"
      />

      <ThemedText type="small" themeColor="textSecondary">Quantity</ThemedText>
      <TextInput
        value={qty}
        onChangeText={setQty}
        keyboardType="number-pad"
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />

      <ThemedText type="small" themeColor="textSecondary">Storage zone</ThemedText>
      <View style={styles.zones}>
        {ZONES.map((z) => (
          <Pressable
            key={z}
            onPress={() => setZone(z)}
            style={[
              styles.zone,
              { backgroundColor: zone === z ? '#208AEF' : theme.backgroundElement },
            ]}>
            <ThemedText type="small" style={{ color: zone === z ? '#fff' : theme.text }}>
              {z === 'auto' ? 'Auto' : z[0].toUpperCase() + z.slice(1)}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        “Auto” uses the built-in food database, or estimates a safe shelf life if unknown.
      </ThemedText>

      <Pressable
        style={[styles.primary, { backgroundColor: '#208AEF', opacity: name.trim() && !busy ? 1 : 0.5 }]}
        disabled={!name.trim() || busy}
        onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <ThemedText type="smallBold" style={{ color: '#fff' }}>Add to pantry</ThemedText>}
      </Pressable>

      <View style={styles.divider}>
        <ThemedText type="small" themeColor="textSecondary">or</ThemedText>
      </View>

      <View style={styles.altRow}>
        <Pressable
          style={[styles.alt, { backgroundColor: theme.backgroundElement }]}
          onPress={() => router.push('/scan')}>
          <ThemedText type="smallBold">📷 Scan barcode</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.alt, { backgroundColor: theme.backgroundElement }]}
          onPress={snapReceipt}>
          <ThemedText type="smallBold">🧾 Snap receipt</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three, gap: Spacing.two },
  input: { borderRadius: Spacing.two, padding: Spacing.three, fontSize: 16 },
  zones: { flexDirection: 'row', gap: Spacing.two },
  zone: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two },
  hint: { marginTop: Spacing.one },
  primary: { alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three, marginTop: Spacing.three },
  divider: { alignItems: 'center', paddingVertical: Spacing.two },
  altRow: { flexDirection: 'row', gap: Spacing.three },
  alt: { flex: 1, alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three },
});
