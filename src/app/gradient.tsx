import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { MeshGradientView } from '../../modules/mesh-gradient/src';

const AnimatedMeshGradientView = Animated.createAnimatedComponent(MeshGradientView);

const COLORS = [
  '#20233F', '#34345C', '#56558A',
  '#535F91', '#7583B2', '#A1A7CC',
  '#A5A9C9', '#D0B9C9', '#E3C9C8',
];

const BASE_POINTS = [
  [0, 0], [0.5, 0], [1, 0],
  [0, 0.5], [0.5, 0.5], [1, 0.5],
  [0, 1], [0.5, 1], [1, 1],
];

export default function GradientScreen() {
  const { width, height } = useWindowDimensions();
  const phase = useSharedValue(0);

  useFrameCallback((frame) => {
    if (frame.timeSincePreviousFrame !== null) {
      phase.value += (frame.timeSincePreviousFrame / 14000) * Math.PI * 2;
    }
  });

  const meshProps = useAnimatedProps(() => ({
    progress: phase.value / (Math.PI * 2),
  }));

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

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.meshMotion, { width: width * 1.2, height: height * 1.2, left: -width * 0.1, top: -height * 0.1 }, meshMotion]}>
        <AnimatedMeshGradientView
          style={StyleSheet.absoluteFill}
          columns={3}
          rows={3}
          colors={COLORS}
          points={BASE_POINTS}
          smoothsColors
          animatedProps={meshProps}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#20233F' },
  meshMotion: { position: 'absolute' },
});