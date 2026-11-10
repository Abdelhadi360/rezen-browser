import type { ColorValue, ViewProps } from 'react-native';

export type MeshGradientViewProps = ViewProps & {
  /** Number of mesh vertices in each row. Must be at least 2. */
  columns: number;
  /** Number of mesh vertices in each column. Must be at least 2. */
  rows: number;
  /** Normalized [x, y] coordinates, in row-major order. */
  points?: number[][];
  /** One color per vertex, in row-major order. */
  colors: ColorValue[];
  /** Use Catmull-Rom interpolation for smoother color transitions. */
  smoothsColors?: boolean;
  /** A phase in turns, suitable for Reanimated animatedProps and allowed to increase continuously. */
  progress?: number;
};