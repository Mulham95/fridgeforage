import { useColorScheme } from 'react-native';

/**
 * Design tokens for FridgeForage. A fresh green→teal identity, soft surfaces,
 * generous radii, and semantic freshness colors (green/amber/red).
 */

export const palette = {
  green: '#16A34A',
  greenBright: '#22C55E',
  mint: '#34D399',
  teal: '#0D9488',
  amber: '#F59E0B',
  amberSoft: '#FBBF24',
  red: '#EF4444',
  redDeep: '#DC2626',
  white: '#FFFFFF',
  black: '#0A0F0D',
};

export const gradients = {
  hero: ['#34D399', '#10B981', '#0D9488'] as const,
  primary: ['#22C55E', '#10B981'] as const,
  fresh: ['#34D399', '#10B981'] as const,
  soon: ['#FBBF24', '#F59E0B'] as const,
  danger: ['#F87171', '#DC2626'] as const,
  cook: ['#FB923C', '#EF4444'] as const,
};

const light = {
  bg: '#F4F6F5',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F0',
  text: '#0B1A14',
  textMuted: '#5B6B64',
  border: '#E2E8E5',
  primary: palette.green,
  onPrimary: '#FFFFFF',
  fresh: palette.green,
  soon: palette.amber,
  danger: palette.red,
  ringTrack: '#E6ECE9',
  heroText: '#FFFFFF',
  heroSub: 'rgba(255,255,255,0.85)',
  shadowColor: '#0B1A14',
};

const dark = {
  bg: '#0A0F0D',
  surface: '#141A17',
  surfaceAlt: '#1C2420',
  text: '#ECFDF5',
  textMuted: '#8CA39A',
  border: '#222B27',
  primary: palette.greenBright,
  onPrimary: '#04150E',
  fresh: palette.mint,
  soon: palette.amberSoft,
  danger: '#F87171',
  ringTrack: '#222B27',
  heroText: '#FFFFFF',
  heroSub: 'rgba(255,255,255,0.85)',
  shadowColor: '#000000',
};

export type AppColors = typeof light;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const radius = { sm: 12, md: 18, lg: 24, xl: 30, pill: 999 } as const;

/**
 * Spline Sans display font. The weight is baked into the family name, so use
 * these instead of `fontWeight` for headings/numbers/buttons (mixing the two
 * fake-bolds on Android). Body/secondary text keeps the system font.
 */
export const font = {
  regular: 'SplineSans_400Regular',
  medium: 'SplineSans_500Medium',
  semibold: 'SplineSans_600SemiBold',
  bold: 'SplineSans_700Bold',
} as const;

export const shadow = {
  card: {
    shadowColor: '#0B1A14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  floating: {
    shadowColor: '#0B1A14',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;

export function useColors(): AppColors & { scheme: 'light' | 'dark' } {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { ...(scheme === 'dark' ? dark : light), scheme };
}
