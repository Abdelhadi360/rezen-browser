package expo.modules.composemeshgradient

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MeshGradientModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoComposeMeshGradient")

    View(MeshGradientView::class)
  }
}