import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { GradientButton } from '@/components/ui/gradient-button';
import { useColors, gradients, radius, space } from '@/theme/tokens';
import { addScannedBarcode } from '@/engine/barcode';

export default function ScanScreen() {
  const c = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const handled = useRef(false);
  const [busy, setBusy] = useState(false);

  if (!permission) return <View style={[styles.center, { backgroundColor: c.bg }]} />;

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Ionicons name="camera" size={48} color={c.primary} />
        <Text style={[styles.permTitle, { color: c.text }]}>Camera access</Text>
        <Text style={[styles.permText, { color: c.textMuted }]}>
          FridgeForage needs the camera to scan product barcodes.
        </Text>
        <GradientButton label="Grant access" colors={gradients.primary} onPress={requestPermission} />
      </View>
    );
  }

  const onScan = async (res: BarcodeScanningResult) => {
    if (handled.current) return;
    handled.current = true;
    setBusy(true);
    try {
      const out = await addScannedBarcode(res.data);
      const msg =
        out.source === 'not_found'
          ? `Couldn't identify barcode ${res.data}. Try adding it by name instead.`
          : `${out.productName} added to your pantry.`;
      Alert.alert(out.source === 'not_found' ? 'Not recognized' : 'Added ✓', msg, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Scan failed', String(e), [{ text: 'OK', onPress: () => router.back() }]);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={handled.current ? undefined : onScan}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.reticle} />
        <View style={styles.hintPill}>
          {busy && <ActivityIndicator color="#fff" />}
          <Text style={styles.hint}>{busy ? 'Looking it up…' : 'Point at a barcode'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.lg },
  permTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  permText: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginBottom: space.sm },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  reticle: { width: 250, height: 150, borderWidth: 3, borderColor: '#fff', borderRadius: radius.lg, opacity: 0.95 },
  hintPill: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill,
  },
  hint: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
