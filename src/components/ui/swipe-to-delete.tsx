import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { palette } from '@/theme/tokens';

const DELETE_THRESHOLD = -90;

type Props = {
  children: ReactNode;
  onDelete: () => void;
};

/**
 * Wraps a row component with a swipe-left-to-reveal-delete gesture.
 * Swiping past the threshold snaps the red "Delete" zone into view;
 * releasing triggers `onDelete`.
 */
export function SwipeToDelete({ children, onDelete }: Props) {
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      // Only allow leftward swipe.
      translateX.value = Math.min(0, e.translationX);
    })
    .onEnd(() => {
      if (translateX.value < DELETE_THRESHOLD) {
        translateX.value = withTiming(-200, { duration: 200 });
        runOnJS(onDelete)();
      } else {
        translateX.value = withSpring(0, { damping: 20 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, -translateX.value / 80),
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.bg, bgStyle]}>
        <Ionicons name="trash" size={22} color="#fff" />
        <Text style={styles.bgText}>Delete</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { overflow: 'hidden' },
  bg: {
    ...StyleSheet.absoluteFill as object,
    backgroundColor: palette.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 24,
    gap: 8,
    borderRadius: 18,
  },
  bgText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
