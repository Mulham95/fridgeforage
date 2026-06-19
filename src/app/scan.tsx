import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { addScannedBarcode } from '@/engine/barcode';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const handled = useRef(false);
  const [busy, setBusy] = useState(false);

  if (!permission) {
    return <ThemedView style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle" style={styles.permTitle}>Camera access</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.permText}>
          FridgeForage needs the camera to scan barcodes.
        </ThemedText>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>Grant access</ThemedText>
        </Pressable>
      </ThemedView>
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
      Alert.alert(out.source === 'not_found' ? 'Not recognized' : 'Added', msg, [
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
        <ThemedText style={styles.hint}>{busy ? 'Looking it up…' : 'Point at a barcode'}</ThemedText>
        {busy && <ActivityIndicator color="#fff" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  permTitle: { textAlign: 'center' },
  permText: { textAlign: 'center' },
  permBtn: { backgroundColor: '#208AEF', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Spacing.three },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  reticle: { width: 240, height: 140, borderWidth: 3, borderColor: '#fff', borderRadius: Spacing.three, opacity: 0.9 },
  hint: { color: '#fff', fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.two },
});
