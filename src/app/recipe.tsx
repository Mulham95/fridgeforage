import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { GradientButton } from '@/components/ui/gradient-button';
import { useColors, gradients, radius, shadow, space } from '@/theme/tokens';
import { getAllItems, getExpiringItems } from '@/engine/db';
import { aiGenerateRecipe, type RecipeResult } from '@/engine/llm';

export default function RecipeScreen() {
  const c = useColors();
  const [names, setNames] = useState<string[]>([]);
  const [recipe, setRecipe] = useState<RecipeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let expiring = await getExpiringItems(48);
      if (expiring.length === 0) expiring = (await getAllItems()).slice(0, 5);
      setNames(expiring.map((i) => i.normalized_name));
    })();
  }, []);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setRecipe(null);
    try {
      const r = await aiGenerateRecipe(names);
      if (!r) setError('Could not reach the recipe service. Make sure the AI proxy is configured.');
      else setRecipe(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [names]);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.label, { color: c.textMuted }]}>Using your soon-to-expire items</Text>
      <View style={styles.chips}>
        {names.length === 0 ? (
          <Text style={{ color: c.textMuted }}>No items yet — add some groceries first.</Text>
        ) : (
          names.map((n, i) => (
            <Animated.View key={n} entering={FadeInDown.delay(i * 50).springify().damping(16)} style={[styles.chip, { backgroundColor: c.surface }, shadow.card]}>
              <Text style={[styles.chipText, { color: c.text }]}>{n}</Text>
            </Animated.View>
          ))
        )}
      </View>

      <GradientButton
        label={busy ? 'Cooking up ideas…' : 'Generate recipe'}
        colors={gradients.cook}
        disabled={!names.length || busy}
        onPress={generate}
        icon={busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="restaurant" size={20} color="#fff" />}
      />

      {error && (
        <Animated.View entering={FadeIn} style={[styles.card, { backgroundColor: c.surface }, shadow.card]}>
          <Text style={{ color: c.danger, fontWeight: '600' }}>{error}</Text>
        </Animated.View>
      )}

      {recipe && (
        <Animated.View entering={FadeInDown.springify().damping(16)} style={[styles.card, { backgroundColor: c.surface }, shadow.card]}>
          <LinearGradient colors={gradients.cook} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.recipeHeader}>
            <Text style={styles.recipeTitle}>{recipe.title}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="time-outline" size={13} color="#fff" />
                <Text style={styles.metaText}>{recipe.prep_time_minutes + recipe.cook_time_minutes} min</Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="speedometer-outline" size={13} color="#fff" />
                <Text style={styles.metaText}>{recipe.difficulty_rating}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.recipeBody}>
            <Text style={[styles.section, { color: c.textMuted }]}>USES</Text>
            <Text style={[styles.bodyText, { color: c.text }]}>{recipe.expiring_items_utilized.join(' · ')}</Text>

            {recipe.common_pantry_staples_required.length > 0 && (
              <>
                <Text style={[styles.section, { color: c.textMuted }]}>YOU'LL ALSO NEED</Text>
                <Text style={[styles.bodyText, { color: c.textMuted }]}>
                  {recipe.common_pantry_staples_required.join(' · ')}
                </Text>
              </>
            )}

            <Text style={[styles.section, { color: c.textMuted }]}>STEPS</Text>
            {recipe.mobile_ui_steps.map((s, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(i * 70)} style={styles.step}>
                <View style={[styles.stepNum, { backgroundColor: c.primary }]}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepText, { color: c.text }]}>{s}</Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  chipText: { fontSize: 13, fontWeight: '700' },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  recipeHeader: { padding: space.xl, gap: space.md },
  recipeTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', gap: space.sm },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill,
  },
  metaText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  recipeBody: { padding: space.xl, gap: space.sm },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: space.sm },
  bodyText: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginTop: space.xs },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 15, fontWeight: '500', lineHeight: 22, paddingTop: 2 },
});
