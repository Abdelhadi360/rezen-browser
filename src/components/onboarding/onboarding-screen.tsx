import AsyncStorage from '@react-native-async-storage/async-storage';
import { MeshGradientView } from 'expo-mesh-gradient';
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

const ONBOARDING_KEY = 'thermal.onboarding.completed.v1';
const INTRO_COLORS = [
  '#D7E5D5', '#EAF0E6', '#D4E3D1',
  '#E5EEE1', '#F5F7F1', '#D5E4D2',
  '#EBF1E8', '#DDE9DA', '#EFF3EA',
];
const DEFAULT_COLORS = [
  '#FCFCFA', '#FAFBF7', '#F7F9F2',
  '#F5F7EF', '#F1F4E9', '#EEF1E5',
  '#F8F9F4', '#F4F6EE', '#F0F3E8',
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
      const speed = 1 + Math.exp(-elapsedMotion.value / 2600);
      meshPhase.value += (frame.timeSincePreviousFrame / 22000) * Math.PI * 2 * speed;
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
      const phase = ((elapsed + 2600 * (1 - Math.exp(-elapsed / 2600))) / 22000) * Math.PI * 2;
      const pointMotion = 0.16 * (1 - transition);

      setMeshPoints([
        DEFAULT_POINTS[0],
        [0.7 + Math.sin(phase + 0.7) * pointMotion, 0],
        DEFAULT_POINTS[2],
        [0, 0.5 + Math.sin(phase + 2.1) * pointMotion],
        [0.5 + Math.sin(phase) * pointMotion, 0.5 + Math.cos(phase) * pointMotion],
        [1, 0.5 + Math.sin(phase + 4.1) * pointMotion],
        DEFAULT_POINTS[6],
        [0.5 + Math.sin(phase + 3.4) * pointMotion, 1],
        DEFAULT_POINTS[8],
      ]);

      if (progress === 1) {
        setMeshColors(DEFAULT_COLORS);
        setMeshPoints(DEFAULT_POINTS);
        return;
      }

      setMeshColors(INTRO_COLORS.map((color, index) => blendColor(color, DEFAULT_COLORS[index], transition)));
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
        { translateX: Math.sin(phase) * width * (0.004 + (1 - zoomProgress) * 0.04) },
        { translateY: Math.cos(phase * 0.8) * height * (0.004 + (1 - zoomProgress) * 0.035) },
        { rotate: `${Math.sin(phase * 0.52) * (0.12 + (1 - zoomProgress) * 2.3)}deg` },
        { scale: 1.002 + (1 - zoomProgress) * 0.48 + Math.sin(phase * 0.7) * 0.002 },
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
  startButtonWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  startButton: {
    minWidth: 170,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#26382B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  startLabel: { color: '#1F2B23', fontSize: 17, fontWeight: '700' },
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