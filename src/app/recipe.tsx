import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getAllItems, getExpiringItems } from '@/engine/db';
import { aiGenerateRecipe, type RecipeResult } from '@/engine/llm';

export default function RecipeScreen() {
  const theme = useTheme();
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
      if (!r) setError('Could not reach the recipe service. Check that the AI proxy is configured.');
      else setRecipe(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [names]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary">Using these soon-to-expire items:</ThemedText>
        <View style={styles.chips}>
          {names.length === 0 ? (
            <ThemedText themeColor="textSecondary">No items yet — add some groceries first.</ThemedText>
          ) : (
            names.map((n) => (
              <View key={n} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small">{n}</ThemedText>
              </View>
            ))
          )}
        </View>

        <Pressable
          style={[styles.cta, { backgroundColor: '#208AEF', opacity: names.length && !busy ? 1 : 0.5 }]}
          disabled={!names.length || busy}
          onPress={generate}>
          {busy ? <ActivityIndicator color="#fff" /> : <ThemedText type="smallBold" style={{ color: '#fff' }}>🍳 Generate recipe</ThemedText>}
        </Pressable>

        {error && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText style={{ color: '#E5484D' }}>{error}</ThemedText>
          </ThemedView>
        )}

        {recipe && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle">{recipe.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              ⏱ {recipe.prep_time_minutes + recipe.cook_time_minutes} min · {recipe.difficulty_rating}
            </ThemedText>

            <ThemedText type="smallBold" style={styles.section}>Uses</ThemedText>
            <ThemedText type="small">{recipe.expiring_items_utilized.join(', ')}</ThemedText>

            {recipe.common_pantry_staples_required.length > 0 && (
              <>
                <ThemedText type="smallBold" style={styles.section}>You'll also need</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {recipe.common_pantry_staples_required.join(', ')}
                </ThemedText>
              </>
            )}

            <ThemedText type="smallBold" style={styles.section}>Steps</ThemedText>
            {recipe.mobile_ui_steps.map((s, i) => (
              <View key={i} style={styles.step}>
                <ThemedText type="smallBold" style={{ color: '#208AEF' }}>{i + 1}.</ThemedText>
                <ThemedText type="small" style={styles.stepText}>{s}</ThemedText>
              </View>
            ))}
          </ThemedView>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 999 },
  cta: { alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  section: { marginTop: Spacing.two },
  step: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  stepText: { flex: 1 },
});
