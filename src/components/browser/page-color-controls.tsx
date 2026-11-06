import { Button } from 'heroui-native';
import { useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BrowserGlyph } from './browser-icons';

const COLOR_PRESETS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#F43F5E',
];

export type WebsiteColorTarget = 'background' | 'text';

export function WebsiteColorControls({
  target,
  color,
  onTargetChange,
  onColorChange,
  onReset,
}: {
  target: WebsiteColorTarget;
  color: string;
  onTargetChange: (target: WebsiteColorTarget) => void;
  onColorChange: (color: string) => void;
  onReset: () => void;
}) {
  return (
    <View style={styles.controls}>
      <View style={styles.targetSelector}>
        <Button variant={target === 'background' ? 'secondary' : 'ghost'} size="sm" onPress={() => onTargetChange('background')} style={styles.targetButton}>
          <Button.Label>Background</Button.Label>
        </Button>
        <Button variant={target === 'text' ? 'secondary' : 'ghost'} size="sm" onPress={() => onTargetChange('text')} style={styles.targetButton}>
          <Button.Label>Text</Button.Label>
        </Button>
      </View>
      <ColorPickerSquare color={color} onChange={onColorChange} />
      <Button variant="ghost" size="sm" onPress={onReset} style={styles.resetButton}>
        <BrowserGlyph name="undo" size={17} color="#555B60" />
        <Button.Label>Reset to default</Button.Label>
      </Button>
    </View>
  );
}

function ColorPickerSquare({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const pickerWidth = Math.min(screenWidth - 48, 390);
  const pickerHeight = Math.max(220, Math.min(300, pickerWidth * 0.78));
  const onChangeRef = useRef(onChange);
  const colorRef = useRef(color);
  const widthRef = useRef(pickerWidth);
  const heightRef = useRef(pickerHeight);
  onChangeRef.current = onChange;
  colorRef.current = color;
  widthRef.current = pickerWidth;
  heightRef.current = pickerHeight;
  const hsv = hsvFromHex(color);
  const marker = { x: hsv.saturation * pickerWidth, y: (1 - hsv.value) * pickerHeight };
  const commitColor = (nextColor: string) => {
    colorRef.current = nextColor;
    onChangeRef.current(nextColor);
  };
  const updateColor = (event: GestureResponderEvent) => {
    const x = Math.max(0, Math.min(widthRef.current, event.nativeEvent.locationX));
    const y = Math.max(0, Math.min(heightRef.current, event.nativeEvent.locationY));
    const current = hsvFromHex(colorRef.current);
    commitColor(hsvToHex(current.hue, x / widthRef.current, 1 - y / heightRef.current));
  };
  const updateHue = (event: GestureResponderEvent) => {
    const hue = (Math.max(0, Math.min(widthRef.current, event.nativeEvent.locationX)) / widthRef.current) * 360;
    const current = hsvFromHex(colorRef.current);
    commitColor(hsvToHex(hue, current.saturation, current.value));
  };
  const areaResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: updateColor,
    onPanResponderMove: updateColor,
  })).current;
  const hueResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: updateHue,
    onPanResponderMove: updateHue,
  })).current;
  const hexColor = normalizeHex(color);
  const hueColor = hsvToHex(hsv.hue, 1, 1);

  return (
    <View style={styles.pickerContent}>
      <View style={styles.colorReadout}>
        <Text style={styles.pickerSectionLabel}>Saturation and brightness</Text>
        <View style={styles.hexReadout}>
          <View style={[styles.colorPreview, { backgroundColor: hexColor }]} />
          <Text style={styles.hexValue}>{hexColor.toUpperCase()}</Text>
        </View>
      </View>
      <View
        {...areaResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Saturation and brightness"
        accessibilityHint="Drag to choose color intensity and brightness"
        style={[styles.colorPicker, { width: pickerWidth, height: pickerHeight }]}>
      <Svg width={pickerWidth} height={pickerHeight} pointerEvents="none">
        <Defs>
          <LinearGradient id="color-picker-saturation" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor={hueColor} />
          </LinearGradient>
          <LinearGradient id="color-picker-brightness" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <Stop offset="100%" stopColor="#000000" />
          </LinearGradient>
        </Defs>
        <Rect width={pickerWidth} height={pickerHeight} rx={18} fill={hueColor} />
        <Rect width={pickerWidth} height={pickerHeight} rx={18} fill="url(#color-picker-saturation)" />
        <Rect width={pickerWidth} height={pickerHeight} rx={18} fill="url(#color-picker-brightness)" />
        <Circle cx={marker.x} cy={marker.y} r={10} fill={hexColor} stroke="#FFFFFF" strokeWidth={3} />
      </Svg>
      </View>
      <View style={styles.hueHeader}>
        <Text style={styles.pickerSectionLabel}>Hue</Text>
        <Text style={styles.hueValue}>{Math.round(hsv.hue)}°</Text>
      </View>
      <View
        {...hueResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Hue"
        accessibilityValue={{ min: 0, max: 360, now: Math.round(hsv.hue) }}
        style={[styles.hueRail, { width: pickerWidth }]}>
        <Svg width={pickerWidth} height={28} pointerEvents="none">
          <Defs>
            <LinearGradient id="color-picker-hue" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#FF0000" />
              <Stop offset="17%" stopColor="#FFFF00" />
              <Stop offset="33%" stopColor="#00FF00" />
              <Stop offset="50%" stopColor="#00FFFF" />
              <Stop offset="67%" stopColor="#0000FF" />
              <Stop offset="83%" stopColor="#FF00FF" />
              <Stop offset="100%" stopColor="#FF0000" />
            </LinearGradient>
          </Defs>
          <Rect width={pickerWidth} height={28} rx={14} fill="url(#color-picker-hue)" />
          <Circle cx={(hsv.hue / 360) * pickerWidth} cy={14} r={10} fill={hueColor} stroke="#FFFFFF" strokeWidth={3} />
        </Svg>
      </View>
      <View style={styles.presetRow}>
        {COLOR_PRESETS.map((preset) => (
          <Pressable
            key={preset}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${preset}`}
            accessibilityState={{ selected: hexColor.toLowerCase() === preset.toLowerCase() }}
            onPress={() => commitColor(preset)}
            style={styles.presetButton}>
            <View style={[styles.presetSwatch, { backgroundColor: preset }]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function hsvFromHex(color: string) {
  const hex = normalizeHex(color).slice(1);
  const [red, green, blue] = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: maximum === 0 ? 0 : delta / maximum,
    value: maximum,
  };
}

function hsvToHex(hue: number, saturation: number, value: number) {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const chroma = value * saturation;
  const secondary = chroma * (1 - Math.abs((normalizedHue / 60) % 2 - 1));
  const offset = value - chroma;
  const channels = normalizedHue < 60 ? [chroma, secondary, 0]
    : normalizedHue < 120 ? [secondary, chroma, 0]
    : normalizedHue < 180 ? [0, chroma, secondary]
    : normalizedHue < 240 ? [0, secondary, chroma]
    : normalizedHue < 300 ? [secondary, 0, chroma]
    : [chroma, 0, secondary];
  return `#${channels.map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function normalizeHex(color: string) {
  return /^#[\da-f]{6}$/i.test(color) ? color : '#FFFFFF';
}

const styles = StyleSheet.create({
  controls: { gap: 8 },
  targetSelector: { flexDirection: 'row', gap: 8 },
  targetButton: { flex: 1, minHeight: 38, borderRadius: 12 },
  pickerContent: { gap: 10, alignItems: 'center' },
  colorReadout: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerSectionLabel: { color: '#555B60', fontSize: 13, fontWeight: '600' },
  hexReadout: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  colorPreview: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#D5D8DA' },
  hexValue: { color: '#31363A', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  colorPicker: { alignSelf: 'center', overflow: 'hidden', borderRadius: 18, backgroundColor: '#09090B' },
  hueHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hueValue: { color: '#777E83', fontSize: 12, fontVariant: ['tabular-nums'] },
  hueRail: { height: 28, borderRadius: 14, overflow: 'hidden' },
  presetRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  presetButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  presetSwatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  resetButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12 },
});