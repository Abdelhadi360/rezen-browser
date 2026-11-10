package expo.modules.composemeshgradient

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Canvas as ComposeCanvas
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.VertexMode
import androidx.compose.ui.graphics.Vertices
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.lerp
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ComposableScope
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.ExpoComposeView
import expo.modules.kotlin.views.OptimizedComposeProps
import kotlin.math.cos
import kotlin.math.PI
import kotlin.math.sin

@OptimizedComposeProps
data class MeshGradientViewProps(
  val columns: MutableState<Int> = mutableIntStateOf(0),
  val rows: MutableState<Int> = mutableIntStateOf(0),
  val points: MutableState<List<Pair<Float, Float>>> = mutableStateOf(emptyList()),
  val colors: MutableState<List<Int>> = mutableStateOf(emptyList()),
  val smoothsColors: MutableState<Boolean> = mutableStateOf(true),
  val progress: MutableState<Float> = mutableFloatStateOf(0f)
) : ComposeProps

class MeshGradientView(context: Context, appContext: AppContext) :
  ExpoComposeView<MeshGradientViewProps>(context, appContext, withHostingView = true) {
  override val props = MeshGradientViewProps()
  private val paint = Paint()

  @Composable
  override fun ComposableScope.Content() {
    val rows = props.rows.value
    val columns = props.columns.value
    val points = props.points.value
    val colors = props.colors.value
    val smoothsColors = props.smoothsColors.value
    val progress = props.progress

    Canvas(Modifier.fillMaxSize()) {
      if (rows < 2 || columns < 2 || colors.size < rows * columns) return@Canvas

      val subdivisions = if (smoothsColors) 8 else 1
      val meshRows = (rows - 1) * subdivisions + 1
      val meshColumns = (columns - 1) * subdivisions + 1
      val phase = progress.value * 2f * PI.toFloat()
      val positions = ArrayList<Offset>(meshRows * meshColumns)
      val vertexColors = ArrayList<Color>(meshRows * meshColumns)
      val indices = ArrayList<Int>((meshRows - 1) * (meshColumns - 1) * 6)

      fun pointAt(row: Int, column: Int): Offset {
        val index = row * columns + column
        val point = points.getOrNull(index)
          ?: Pair(column / (columns - 1).toFloat(), row / (rows - 1).toFloat())
        val moves = row in 1 until rows - 1 && column in 1 until columns - 1
        val xOffset = if (moves) sin(phase + index) * 0.07f else 0f
        val yOffset = if (moves) cos(phase * 0.8f + index) * 0.07f else 0f
        return Offset(point.first + xOffset, point.second + yOffset)
      }

      fun colorAt(row: Int, column: Int) = Color(colors[row * columns + column])

      for (meshRow in 0 until meshRows) {
        val y = meshRow / (meshRows - 1).toFloat()
        val patchRow = minOf((y * (rows - 1)).toInt(), rows - 2)
        val localY = y * (rows - 1) - patchRow

        for (meshColumn in 0 until meshColumns) {
          val x = meshColumn / (meshColumns - 1).toFloat()
          val patchColumn = minOf((x * (columns - 1)).toInt(), columns - 2)
          val localX = x * (columns - 1) - patchColumn
          val topLeft = pointAt(patchRow, patchColumn)
          val topRight = pointAt(patchRow, patchColumn + 1)
          val bottomLeft = pointAt(patchRow + 1, patchColumn)
          val bottomRight = pointAt(patchRow + 1, patchColumn + 1)
          val top = Offset(
            topLeft.x * (1f - localX) + topRight.x * localX,
            topLeft.y * (1f - localX) + topRight.y * localX
          )
          val bottom = Offset(
            bottomLeft.x * (1f - localX) + bottomRight.x * localX,
            bottomLeft.y * (1f - localX) + bottomRight.y * localX
          )
          positions.add(
            Offset(
              (top.x * (1f - localY) + bottom.x * localY) * size.width,
              (top.y * (1f - localY) + bottom.y * localY) * size.height
            )
          )

          val topColor = lerp(colorAt(patchRow, patchColumn), colorAt(patchRow, patchColumn + 1), localX)
          val bottomColor = lerp(colorAt(patchRow + 1, patchColumn), colorAt(patchRow + 1, patchColumn + 1), localX)
          vertexColors.add(lerp(topColor, bottomColor, localY))
        }
      }

      for (row in 0 until meshRows - 1) {
        for (column in 0 until meshColumns - 1) {
          val topLeft = row * meshColumns + column
          val topRight = topLeft + 1
          val bottomLeft = topLeft + meshColumns
          val bottomRight = bottomLeft + 1
          indices.add(topLeft)
          indices.add(bottomLeft)
          indices.add(bottomRight)
          indices.add(topLeft)
          indices.add(topRight)
          indices.add(bottomRight)
        }
      }

      drawIntoCanvas { canvas: ComposeCanvas ->
        canvas.drawVertices(
          vertices = Vertices(
            vertexMode = VertexMode.Triangles,
            positions = positions,
            textureCoordinates = positions,
            colors = vertexColors,
            indices = indices
          ),
          blendMode = BlendMode.SrcOver,
          paint = paint
        )
      }
    }
  }
}