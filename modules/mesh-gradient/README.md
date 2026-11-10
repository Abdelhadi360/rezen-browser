# Compose Mesh Gradient

An Android Expo native view backed by Jetpack Compose Canvas vertex rendering. It tessellates each mesh patch and interpolates its vertex colors. The TypeScript component falls back to `expo-mesh-gradient` on iOS and web.

```tsx
import { MeshGradientView } from '../../modules/mesh-gradient/src';

<MeshGradientView
  style={{ flex: 1 }}
  rows={3}
  columns={3}
  colors={['#1F2B23', '#485C41', '#788260', '#5A6B4D', '#A4A789', '#BBB99F', '#8E9474', '#BBB99F', '#F0F3E8']}
  points={[
    [0, 0], [0.5, 0], [1, 0],
    [0, 0.5], [0.5, 0.5], [1, 0.5],
    [0, 1], [0.5, 1], [1, 1],
  ]}
/>
```

The Android view also accepts a numeric `progress` prop measured in turns. It may increase continuously for seamless looping and is designed to be driven by Reanimated `useAnimatedProps`; drawing and point interpolation remain in Compose rather than causing React renders per frame.