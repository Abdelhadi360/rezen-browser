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
import { ONBOARDING_COMPLETED_KEY } from '@/constants/onboarding';

const INTRO_COLORS = [
  '#FFF7E9', '#FFF4E8', '#FFF7E9',
  '#4169FF', '#FF4778', '#FF597C',
  '#315FF5', '#FF806D', '#FFF7E9',
];
const DEFAULT_COLORS = [
  '#FFF7E9', '#FFF6EA', '#FFF7E9',
  '#315FF5', '#FB4778', '#FF617D',
  '#315FF5', '#FF806D', '#FFF7E9',
];
const DEFAULT_POINTS = [
  [0.02, 0.02], [0.7, 0.02], [0.98, 0.02],
  [0.02, 0.5], [0.5, 0.5], [0.98, 0.5],
  [0.02, 0.98], [0.5, 0.98], [0.98, 0.98],
];
const POINT_MOTION = [
  [0.012, 0.012], [0.018, 0.012], [0.012, 0.012],
  [0.012, 0.018], [0.035, 0.035], [0.012, 0.018],
  [0.012, 0.012], [0.018, 0.012], [0.012, 0.012],
];
const TRANSITION_DELAY_MS = 350;
const TRANSITION_DURATION_MS = 8200;
const START_REVEAL_DELAY_MS = 9600;
const MOTION_DECAY_MS = 6000;
const MOTION_INITIAL_SPEED = 7;
const MOTION_CRUISE_SPEED = 1.15;
const MOTION_PERIOD_MS = 12000;

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
      const speed = MOTION_CRUISE_SPEED
        + (MOTION_INITIAL_SPEED - MOTION_CRUISE_SPEED) * Math.exp(-elapsedMotion.value / MOTION_DECAY_MS);
      meshPhase.value += (frame.timeSincePreviousFrame / MOTION_PERIOD_MS) * Math.PI * 2 * speed;
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
      const accumulatedMotion = MOTION_CRUISE_SPEED * elapsed
        + (MOTION_INITIAL_SPEED - MOTION_CRUISE_SPEED) * MOTION_DECAY_MS
          * (1 - Math.exp(-elapsed / MOTION_DECAY_MS));
      const phase = (accumulatedMotion / MOTION_PERIOD_MS) * Math.PI * 2;
      setMeshPoints(DEFAULT_POINTS.map((point, index) => animateMeshPoint(point, POINT_MOTION[index], index, phase)));
      const baseColors = INTRO_COLORS.map((color, index) => blendColor(color, DEFAULT_COLORS[index], transition));
      setMeshColors(shiftMeshColors(baseColors, phase));

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
        { translateX: Math.sin(phase) * width * (0.04 + (1 - zoomProgress) * 0.055) },
        { translateY: Math.cos(phase * 0.8) * height * (0.035 + (1 - zoomProgress) * 0.05) },
        { rotate: `${Math.sin(phase * 0.52) * (1.2 + (1 - zoomProgress) * 2.8)}deg` },
        { scale: 1.16 + (1 - zoomProgress) * 0.35 + Math.sin(phase * 0.7) * 0.02 },
      ],
    };
  }, [height, width]);

  const startStyle = useAnimatedStyle(() => ({
    opacity: startProgress.value,
    transform: [{ translateY: 18 * (1 - startProgress.value) }],
  }));

  async function finishOnboarding() {
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true').catch(() => undefined);
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
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#FFF7E9' },
  meshReveal: { position: 'absolute', overflow: 'hidden', backgroundColor: '#FFF7E9' },
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

function animateMeshPoint(point: number[], motion: number[], index: number, phase: number) {
  const [xMotion, yMotion] = motion;
  const x = point[0] + Math.sin(phase + index * 1.73) * xMotion;
  const y = point[1] + Math.cos(phase * 0.83 + index * 2.11) * yMotion;
  return [clamp(x, 0.005, 0.995), clamp(y, 0.005, 0.995)];
}

function shiftMeshColors(colors: string[], phase: number) {
  const offsetX = Math.sin(phase) * 0.38;
  const offsetY = Math.cos(phase * 0.73 + 1.4) * 0.32;

  return colors.map((_, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = smoothReflect(column / 2 + offsetX);
    const y = smoothReflect(row / 2 + offsetY);
    return sampleMeshColor(colors, x, y);
  });
}

function smoothReflect(value: number) {
  const wrapped = ((value % 2) + 2) % 2;
  const reflected = wrapped <= 1 ? wrapped : 2 - wrapped;
  return reflected * reflected * (3 - 2 * reflected);
}

function sampleMeshColor(colors: string[], x: number, y: number) {
  const gridX = x * 2;
  const gridY = y * 2;
  const column = Math.min(Math.floor(gridX), 1);
  const row = Math.min(Math.floor(gridY), 1);
  const localX = gridX - column;
  const localY = gridY - row;
  const top = blendColor(colors[row * 3 + column], colors[row * 3 + column + 1], localX);
  const bottom = blendColor(colors[(row + 1) * 3 + column], colors[(row + 1) * 3 + column + 1], localX);
  return blendColor(top, bottom, localY);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}