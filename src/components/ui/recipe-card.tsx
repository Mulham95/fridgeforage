import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useColors, font, gradients, radius, shadow, space } from '@/theme/tokens';
import type { RecipeResult } from '@/engine/llm';

export function RecipeCard({ recipe }: { recipe: RecipeResult }) {
  const c = useColors();
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16)}
      style={[styles.card, { backgroundColor: c.surface }, shadow.card]}>
      <LinearGradient colors={gradients.cook} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <Text style={styles.title}>{recipe.title}</Text>
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

      <View style={styles.body}>
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
          <View key={i} style={styles.step}>
            <View style={[styles.stepNum, { backgroundColor: c.primary }]}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepText, { color: c.text }]}>{s}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  header: { padding: space.xl, gap: space.md },
  title: { color: '#fff', fontSize: 22, fontFamily: font.bold, letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', gap: space.sm },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill,
  },
  metaText: { color: '#fff', fontSize: 12, fontFamily: font.semibold },
  body: { padding: space.xl, gap: space.sm },
  section: { fontSize: 12, fontFamily: font.bold, letterSpacing: 0.6, marginTop: space.sm },
  bodyText: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginTop: space.xs },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 13, fontFamily: font.bold },
  stepText: { flex: 1, fontSize: 15, fontWeight: '500', lineHeight: 22, paddingTop: 2 },
});
