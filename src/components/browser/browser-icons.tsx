import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  ExternalLink,
  Grip,
  LockKeyhole,
  PanelsTopLeft,
  Plus,
  RotateCw,
  Settings,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Button } from 'heroui-native';
import { StyleSheet, Text } from 'react-native';

const icons = {
  'arrow-up': ArrowUp,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  ellipsis: Ellipsis,
  'external-link': ExternalLink,
  grip: Grip,
  'lock-keyhole': LockKeyhole,
  'panels-top-left': PanelsTopLeft,
  plus: Plus,
  'rotate-cw': RotateCw,
  settings: Settings,
  undo: Undo2,
  close: X,
} satisfies Record<string, LucideIcon>;

export function BrowserGlyph({
  name,
  size = 20,
  color = '#23332F',
  strokeWidth = 2,
}: {
  name: keyof typeof icons;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Icon = icons[name];
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}

export function BrowserIconButton({
  label,
  name,
  onPress,
  count,
}: {
  label: string;
  name: keyof typeof icons;
  onPress: () => void;
  count?: string;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      isIconOnly
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.iconButton}>
      {count ? <Text style={styles.tabCount}>{count}</Text> : <BrowserGlyph name={name} />}
    </Button>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F2F3' },
  tabCount: { color: '#33383D', fontSize: 14, fontWeight: '700' },
});