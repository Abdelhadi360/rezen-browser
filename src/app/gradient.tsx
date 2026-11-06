import { MeshGradientView } from 'expo-mesh-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';

const COLORS = [
  '#1F2B23', '#28362B', '#485C41',
  '#5A6B4D', '#788260', '#8E9474',
  '#A4A789', '#BBB99F', '#BBB99F',
];

const BASE_POINTS = [
  [0, 0], [0.5, 0], [1, 0],
  [0, 0.5], [0.5, 0.5], [1, 0.5],
  [0, 1], [0.5, 1], [1, 1],
];

export default function GradientScreen() {
  const { width, height } = useWindowDimensions();
  const [points, setPoints] = useState<number[][]>(BASE_POINTS);
  const phase = useSharedValue(0);

  useFrameCallback((frame) => {
    if (frame.timeSincePreviousFrame !== null) {
      phase.value += (frame.timeSincePreviousFrame / 14000) * Math.PI * 2;
    }
  });

  const meshMotion = useAnimatedStyle(() => {
    const currentPhase = phase.value;
    return {
      transform: [
        { translateX: Math.sin(currentPhase) * width * 0.045 },
        { translateY: Math.cos(currentPhase * 0.8) * height * 0.04 },
        { rotate: `${Math.sin(currentPhase * 0.55) * 2.5}deg` },
        { scale: 1.15 + Math.sin(currentPhase * 0.7) * 0.025 },
      ],
    };
  }, [height, width]);

  useEffect(() => {
    let frameId = 0;
    const startedAt = Date.now();
    const animate = () => {
      const currentPhase = ((Date.now() - startedAt) / 20000) * Math.PI * 2;
      setPoints([
        BASE_POINTS[0],
        [0.5 + Math.sin(currentPhase + 0.7) * 0.2, 0],
        BASE_POINTS[2],
        [0, 0.5 + Math.sin(currentPhase + 2.2) * 0.2],
        [0.5 + Math.sin(currentPhase) * 0.24, 0.5 + Math.cos(currentPhase) * 0.24],
        [1, 0.5 + Math.sin(currentPhase + 4.1) * 0.2],
        BASE_POINTS[6],
        [0.5 + Math.sin(currentPhase + 3.4) * 0.2, 1],
        BASE_POINTS[8],
      ]);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.meshMotion, { width: width * 1.2, height: height * 1.2, left: -width * 0.1, top: -height * 0.1 }, meshMotion]}>
        <MeshGradientView
          style={StyleSheet.absoluteFill}
          columns={3}
          rows={3}
          colors={COLORS}
          points={points}
          smoothsColors
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#1F2B23' },
  meshMotion: { position: 'absolute' },
});