import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from 'heroui-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MeshGradientView } from '../../../modules/mesh-gradient/src';

const ONBOARDING_KEY = 'rezen.onboarding.completed.v1';
const INTRO_COLORS = [
  '#FFFFFF', '#F3F4FF', '#FFFFFF',
  '#8299F5', '#ECEEFF', '#C9C8FA',
  '#9BAAF8', '#C8CBFF', '#E6E3FF',
];
const DEFAULT_COLORS = [
  '#FFFFFF', '#F7F7FF', '#FFFFFF',
  '#98A9F8', '#EEF0FF', '#D3D0FC',
  '#BEC9FF', '#DADDFE', '#F0EDFF',
];
const DEFAULT_POINTS = [
  [0, 0], [0.7, 0], [1, 0],
  [0, 0.5], [0.5, 0.5], [1, 0.5],
  [0, 1], [0.5, 1], [1, 1],
];
const TRANSITION_DELAY_MS = 350;
const TRANSITION_DURATION_MS = 8200;
const START_REVEAL_DELAY_MS = 9600;

export function OnboardingScreen({ onFinish }: { onFinish: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [showStart, setShowStart] = useState(false);
  const [meshColors, setMeshColors] = useState<string[]>(INTRO_COLORS);
  const [meshPoints, setMeshPoints] = useState<number[][]>(DEFAULT_POINTS);
  const introProgress = useSharedValue(0);
  const meshPhase = useSharedValue(0);
  const elapsedMotion = useSharedValue(0);
  const startProgress = useSharedValue(0);

  useFrameCallback((frame) => {
    if (frame.timeSincePreviousFrame !== null) {
      elapsedMotion.value += frame.timeSincePreviousFrame;
      const speed = 1 + 1.9 * Math.exp(-elapsedMotion.value / 1800);
      meshPhase.value += (frame.timeSincePreviousFrame / 18000) * Math.PI * 2 * speed;
    }
  });

  useEffect(() => {
    introProgress.value = withDelay(
      TRANSITION_DELAY_MS,
      withTiming(1, { duration: TRANSITION_DURATION_MS, easing: Easing.out(Easing.cubic) }),
    );

    let frameId = 0;
    const startedAt = Date.now();
    const animateMesh = () => {
      const elapsed = Date.now() - startedAt;
      const progress = clamp01((elapsed - TRANSITION_DELAY_MS) / TRANSITION_DURATION_MS);
      const transition = easeOutCubic(progress);
      const phase = ((elapsed + 1900 * (1 - Math.exp(-elapsed / 1500))) / 14500) * Math.PI * 2;
      const sideMotion = 0.045 + 0.018 * Math.exp(-elapsed / 2200);

      setMeshPoints([
        DEFAULT_POINTS[0],
        DEFAULT_POINTS[1],
        [1 - Math.cos(phase + 0.4) * sideMotion, Math.sin(phase + 0.4) * sideMotion],
        DEFAULT_POINTS[3],
        DEFAULT_POINTS[4],
        [1 - Math.cos(phase + 2.1) * sideMotion, 0.5 + Math.sin(phase + 2.1) * sideMotion],
        DEFAULT_POINTS[6],
        DEFAULT_POINTS[7],
        [1 - Math.cos(phase + 3.8) * sideMotion, 1 + Math.sin(phase + 3.8) * sideMotion],
      ]);

      if (progress === 1) {
        setMeshColors(DEFAULT_COLORS);
      } else {
        setMeshColors(INTRO_COLORS.map((color, index) => blendColor(color, DEFAULT_COLORS[index], transition)));
      }

      frameId = requestAnimationFrame(animateMesh);
    };

    frameId = requestAnimationFrame(animateMesh);
    const startTimer = setTimeout(() => setShowStart(true), START_REVEAL_DELAY_MS);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(startTimer);
    };
  }, [introProgress]);

  useEffect(() => {
    if (showStart) startProgress.value = withTiming(1, { duration: 700 });
  }, [showStart, startProgress]);

  const meshStyle = useAnimatedStyle(() => {
    const phase = meshPhase.value;
    const zoomProgress = introProgress.value;

    return {
      transform: [
        { translateX: Math.sin(phase) * width * (0.009 + (1 - zoomProgress) * 0.055) },
        { translateY: Math.cos(phase * 0.8) * height * (0.009 + (1 - zoomProgress) * 0.05) },
        { rotate: `${Math.sin(phase * 0.52) * (0.24 + (1 - zoomProgress) * 2.8)}deg` },
        { scale: 1.04 + (1 - zoomProgress) * 0.58 + Math.sin(phase * 0.7) * 0.006 },
      ],
    };
  }, [height, width]);

  const startStyle = useAnimatedStyle(() => ({
    opacity: startProgress.value,
    transform: [{ translateY: 18 * (1 - startProgress.value) }],
  }));

  async function finishOnboarding() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => undefined);
    onFinish();
  }

  return (
    <View style={[styles.root, { width, height }]}>
      <Animated.View style={[styles.meshReveal, { width, height, left: 0, top: 0 }, meshStyle]}>
        <MeshGradientView
          style={StyleSheet.absoluteFill}
          columns={3}
          rows={3}
          colors={meshColors}
          points={meshPoints}
          smoothsColors
        />
      </Animated.View>

      {showStart ? (
        <Animated.View style={[styles.startButtonWrap, { bottom: insets.bottom + 36 }, startStyle]}>
          <Button
            variant="primary"
            size="lg"
            feedbackVariant="scale"
            accessibilityLabel="Start browsing"
            onPress={() => { void finishOnboarding(); }}
            style={styles.startButton}>
            <Button.Label style={styles.startLabel}>Start</Button.Label>
          </Button>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  meshReveal: { position: 'absolute', overflow: 'hidden', backgroundColor: '#FFFFFF' },
  startButtonWrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 28 },
  startButton: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 0,
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0,
    elevation: 0,
  },
  startLabel: { color: '#343BFF', fontSize: 17, fontWeight: '700' },
});

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

function blendColor(from: string, to: string, progress: number) {
  const fromChannels = [1, 3, 5].map((index) => Number.parseInt(from.slice(index, index + 2), 16));
  const toChannels = [1, 3, 5].map((index) => Number.parseInt(to.slice(index, index + 2), 16));
  const channels = fromChannels.map((channel, index) => Math.round(channel + (toChannels[index] - channel) * progress));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}