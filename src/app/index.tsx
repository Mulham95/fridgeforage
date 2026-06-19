import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ProgressRing } from '@/components/ui/progress-ring';
import { StatCard } from '@/components/ui/stat-card';
import { ZoneCard } from '@/components/ui/zone-card';
import { ItemCard, ExpiringCard } from '@/components/ui/item-card';
import { SectionHeader } from '@/components/ui/section-header';
import { PressScale } from '@/components/ui/press-scale';
import { useColors, gradients, palette, radius, shadow, space } from '@/theme/tokens';
import { loadDashboard, type DashboardStats } from '@/lib/stats';
import { deleteItem } from '@/engine/db';

const EMPTY: DashboardStats = {
  total: 0, fresh: 0, soon: 0, expired: 0, freshnessScore: 100,
  byZone: { fridge: 0, pantry: 0, freezer: 0 }, expiringSoon: [], items: [],
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<DashboardStats>(EMPTY);

  const load = useCallback(() => {
    loadDashboard().then(setStats).catch((e) => console.error(e));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Remove item', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteItem(id).then(load) },
    ]);
  };

  const preview = stats.items.slice(0, 4);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        {/* ---- Hero ---- */}
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
          <Animated.View entering={FadeIn.duration(500)} style={styles.heroRow}>
            <View style={styles.heroText}>
              <Text style={styles.greeting}>{greeting()}</Text>
              <Text style={styles.heroTitle}>
                {stats.total === 0 ? 'Let’s stock\nyour kitchen' : `${stats.total} item${stats.total > 1 ? 's' : ''}\nin your kitchen`}
              </Text>
              <View style={styles.heroChip}>
                <Ionicons name="leaf" size={13} color="#fff" />
                <Text style={styles.heroChipText}>
                  {stats.expired + stats.soon === 0 ? 'All fresh' : `${stats.soon + stats.expired} need attention`}
                </Text>
              </View>
            </View>
            <ProgressRing
              size={104}
              stroke={11}
              progress={stats.freshnessScore / 100}
              color="#fff"
              trackColor="rgba(255,255,255,0.28)">
              <View style={styles.ringCenter}>
                <Text style={styles.ringValue}>{stats.freshnessScore}%</Text>
                <Text style={styles.ringLabel}>fresh</Text>
              </View>
            </ProgressRing>
          </Animated.View>
        </LinearGradient>

        <View style={styles.body}>
          {/* ---- Stat cards (overlap hero) ---- */}
          <View style={styles.statRow}>
            <StatCard index={0} label="Fresh" value={stats.fresh} color={palette.green} icon="checkmark-circle" />
            <StatCard index={1} label="Soon" value={stats.soon} color={palette.amber} icon="time" />
            <StatCard index={2} label="Expired" value={stats.expired} color={palette.red} icon="alert-circle" />
          </View>

          {/* ---- Expiring soon ---- */}
          <SectionHeader title="Expiring soon" actionLabel={stats.expiringSoon.length ? 'Cook' : undefined} onAction={() => router.push('/recipe')} />
          {stats.expiringSoon.length === 0 ? (
            <Animated.View entering={FadeInDown.springify().damping(15)} style={[styles.celebrate, { backgroundColor: c.surface }, shadow.card]}>
              <Text style={styles.celebrateEmoji}>🎉</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.celebrateTitle, { color: c.text }]}>Nothing expiring</Text>
                <Text style={[styles.celebrateSub, { color: c.textMuted }]}>Your food is all fresh — nice work.</Text>
              </View>
            </Animated.View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {stats.expiringSoon.map((it, i) => (
                <ExpiringCard key={it.id} item={it} index={i} onPress={() => router.push('/recipe')} />
              ))}
            </ScrollView>
          )}

          {/* ---- Storage zones ---- */}
          <SectionHeader title="Storage" />
          <View style={styles.zoneRow}>
            <ZoneCard index={0} emoji="🧊" label="Fridge" count={stats.byZone.fridge} />
            <ZoneCard index={1} emoji="🥫" label="Pantry" count={stats.byZone.pantry} />
            <ZoneCard index={2} emoji="❄️" label="Freezer" count={stats.byZone.freezer} />
          </View>

          {/* ---- Pantry preview ---- */}
          <SectionHeader
            title="Your pantry"
            actionLabel={stats.items.length > 4 ? 'See all' : undefined}
            onAction={() => router.push('/inventory')}
          />
          {preview.length === 0 ? (
            <Animated.View entering={FadeInDown.springify().damping(15)} style={[styles.emptyCard, { backgroundColor: c.surface }, shadow.card]}>
              <Text style={styles.celebrateEmoji}>🛒</Text>
              <Text style={[styles.celebrateTitle, { color: c.text }]}>Your pantry is empty</Text>
              <Text style={[styles.celebrateSub, { color: c.textMuted, textAlign: 'center' }]}>
                Add groceries, scan a barcode, or snap a receipt to get started.
              </Text>
            </Animated.View>
          ) : (
            <View style={{ gap: space.md }}>
              {preview.map((it, i) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  index={i}
                  onLongPress={() => confirmDelete(it.id, it.normalized_name)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---- Floating action bar ---- */}
      <View style={[styles.fab, { paddingBottom: insets.bottom + space.sm }]}>
        <View style={[styles.fabBar, { backgroundColor: c.surface }, shadow.floating]}>
          <PressScale onPress={() => router.push('/scan')} style={[styles.fabIcon, { backgroundColor: c.surfaceAlt }]}>
            <Ionicons name="barcode-outline" size={22} color={c.text} />
          </PressScale>
          <PressScale onPress={() => router.push('/add')} style={styles.fabAddWrap}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabAdd}>
              <Ionicons name="add" size={22} color="#fff" />
              <Text style={styles.fabAddText}>Add item</Text>
            </LinearGradient>
          </PressScale>
          <PressScale onPress={() => router.push('/recipe')} style={[styles.fabIcon, { backgroundColor: c.surfaceAlt }]}>
            <Ionicons name="restaurant-outline" size={22} color={c.text} />
          </PressScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hero: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl + space.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroText: { flex: 1, gap: space.sm },
  greeting: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '600' },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5 },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, marginTop: space.xs,
  },
  heroChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ringCenter: { alignItems: 'center' },
  ringValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  ringLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },

  body: { paddingHorizontal: space.xl, marginTop: -space.xxxl },
  statRow: { flexDirection: 'row', gap: space.md, marginBottom: space.sm },

  carousel: { gap: space.md, paddingVertical: space.xs, paddingRight: space.lg },
  celebrate: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md },
  celebrateEmoji: { fontSize: 30 },
  celebrateTitle: { fontSize: 16, fontWeight: '800' },
  celebrateSub: { fontSize: 13, fontWeight: '500', marginTop: 2 },

  zoneRow: { flexDirection: 'row', gap: space.md },

  emptyCard: { alignItems: 'center', gap: space.sm, padding: space.xxl, borderRadius: radius.md },

  fab: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl },
  fabBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    padding: space.sm, borderRadius: radius.pill,
  },
  fabIcon: { width: 52, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  fabAddWrap: { flex: 1 },
  fabAdd: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
    height: 52, borderRadius: radius.pill,
  },
  fabAddText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
