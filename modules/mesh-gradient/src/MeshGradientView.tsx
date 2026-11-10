import { MeshGradientView as ExpoMeshGradientView } from 'expo-mesh-gradient';

import type { MeshGradientViewProps } from './MeshGradient.types';

export default function MeshGradientView({ progress: _progress, ...props }: MeshGradientViewProps) {
  return <ExpoMeshGradientView {...props} />;
}