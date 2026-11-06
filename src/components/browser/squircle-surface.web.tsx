import type { ComponentProps } from 'react';
import { View } from 'react-native';

type SquircleSurfaceProps = ComponentProps<typeof View> & {
  cornerSmoothing?: number;
};

export default function SquircleSurface({ cornerSmoothing: _cornerSmoothing, ...props }: SquircleSurfaceProps) {
  return <View {...props} />;
}