import { requireNativeView } from 'expo';
import type { ProcessedColorValue } from 'react-native';
import { processColor } from 'react-native';

import type { MeshGradientViewProps } from './MeshGradient.types';

const NativeView = requireNativeView<
  Omit<MeshGradientViewProps, 'colors'> & {
    colors?: (ProcessedColorValue | null | undefined)[];
  }
>('ExpoComposeMeshGradient');

export default function MeshGradientView({ colors, ...props }: MeshGradientViewProps) {
  return <NativeView {...props} colors={colors.map((color) => processColor(color))} />;
}