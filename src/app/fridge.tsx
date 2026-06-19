import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GradientButton } from '@/components/ui/gradient-button';
import { PressScale } from '@/components/ui/press-scale';
import { RecipeCard } from '@/components/ui/recipe-card';
import { useColors, font, gradients, radius, shadow, space } from '@/theme/tokens';
import { scanFridge, saveDetected, type FridgeScanResult } from '@/engine/fridgeScan';

export default function FridgeScreen() {
  const c = useColors();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<FridgeScanResult | null>(null);

  if (!permission) return <View style={[styles.center, { backgroundColor: c.bg }]} />;

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Ionicons name="camera" size={48} color={c.primary} />
        <Text style={[styles.permTitle, { color: c.text }]}>Camera access</Text>
        <Text style={[styles.permText, { color: c.textMuted }]}>
          FridgeForage uses your camera to see what's in your fridge and suggest a dish.
        </Text>
        <GradientButton label="Grant access" colors={gradients.primary} onPress={requestPermission} />
      </View>
    );
  }

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.4 });
      if (!photo?.base64) throw new Error('Could not capture the photo.');
      const r = await scanFridge(photo.base64);
      setResult(r);
      setSaved(false);
    } catch (e) {
      Alert.alert('Scan failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  const addToPantry = async () => {
    if (!result) return;
    await saveDetected(result.items);
    setSaved(true);
  };

  // ---- Result view ----
  if (result) {
    return (
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
        {result.status !== 'ok' ? (
          <Animated.View entering={FadeInDown.springify().damping(15)} style={[styles.notice, { backgroundColor: c.surface }, shadow.card]}>
            <Ionicons name={result.status === 'no_items' ? 'search' : 'cloud-offline'} size={32} color={c.textMuted} />
            <Text style={[styles.noticeTitle, { color: c.text }]}>
              {result.status === 'no_items' ? 'No ingredients spotted' : 'Couldn’t reach the AI'}
            </Text>
            <Text style={[styles.noticeText, { color: c.textMuted }]}>
              {result.status === 'no_items'
                ? 'Try a clearer, well-lit photo of your open fridge.'
                : 'The recipe service needs the AI proxy configured. Check your connection and try again.'}
            </Text>
          </Animated.View>
        ) : (
          <>
            <Text style={[styles.label, { color: c.textMuted }]}>Spotted in your fridge</Text>
            <View style={styles.chips}>
              {result.items.map((it, i) => (
                <Animated.View
                  key={it.id}
                  entering={FadeInDown.delay(i * 40).springify().damping(16)}
                  style={[styles.chip, { backgroundColor: c.surface }, shadow.card]}>
                  <Text style={[styles.chipText, { color: c.text }]}>{it.normalized_name}</Text>
                </Animated.View>
              ))}
            </View>

            <PressScale onPress={saved ? undefined : addToPantry} disabled={saved}>
              <View style={[styles.addRow, { backgroundColor: c.surface, borderColor: c.border }, shadow.card]}>
                <Ionicons name={saved ? 'checkmark-circle' : 'add-circle-outline'} size={20} color={saved ? c.fresh : c.primary} />
                <Text style={[styles.addText, { color: saved ? c.fresh : c.text }]}>
                  {saved ? `Added ${result.items.length} to pantry` : `Add ${result.items.length} to my pantry`}
                </Text>
              </View>
            </PressScale>

            {result.recipe ? (
              <RecipeCard recipe={result.recipe} />
            ) : (
              <View style={[styles.notice, { backgroundColor: c.surface }, shadow.card]}>
                <Text style={[styles.noticeText, { color: c.textMuted }]}>
                  Detected the ingredients, but couldn’t fetch a recipe (the AI proxy may be offline).
                </Text>
              </View>
            )}
          </>
        )}

        <View style={styles.resultActions}>
          <GradientButton
            label="Scan again"
            colors={gradients.cook}
            onPress={() => setResult(null)}
            icon={<Ionicons name="camera-reverse" size={20} color="#fff" />}
          />
          <PressScale onPress={() => router.back()} style={styles.doneBtn}>
            <Text style={[styles.doneText, { color: c.textMuted }]}>Done</Text>
          </PressScale>
        </View>
      </ScrollView>
    );
  }

  // ---- Camera view ----
  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <View style={styles.hintPill}>
          <Ionicons name="sparkles" size={14} color="#fff" />
          <Text style={styles.hint}>Point at your open fridge</Text>
        </View>
      </View>
      <View style={styles.captureBar}>
        {busy ? (
          <View style={styles.busyPill}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.busyText}>Looking at your fridge…</Text>
          </View>
        ) : (
          <PressScale onPress={capture} style={styles.shutterWrap}>
            <View style={styles.shutterOuter}>
              <View style={styles.shutterInner} />
            </View>
          </PressScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.lg },
  permTitle: { fontSize: 22, fontFamily: font.bold, textAlign: 'center' },
  permText: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginBottom: space.sm },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 120, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  frame: { width: '78%', height: '52%', borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', borderRadius: radius.lg },
  hintPill: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill,
  },
  hint: { color: '#fff', fontFamily: font.semibold, fontSize: 14 },
  captureBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, alignItems: 'center', justifyContent: 'center' },
  shutterWrap: {},
  shutterOuter: { width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
  busyPill: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill,
  },
  busyText: { color: '#fff', fontFamily: font.semibold, fontSize: 14 },

  resultContent: { padding: space.xl, gap: space.lg },
  label: { fontSize: 13, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  chipText: { fontSize: 13, fontFamily: font.semibold },
  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    paddingVertical: space.lg, borderRadius: radius.md, borderWidth: 1,
  },
  addText: { fontSize: 15, fontFamily: font.semibold },
  notice: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.md },
  noticeTitle: { fontSize: 17, fontFamily: font.bold },
  noticeText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  resultActions: { gap: space.md, marginTop: space.sm },
  doneBtn: { alignItems: 'center', paddingVertical: space.sm },
  doneText: { fontSize: 14, fontFamily: font.semibold },
});
