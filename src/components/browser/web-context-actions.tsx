import { AnimatedSquircleView } from '@pankajtime12/react-native-squircle-view';
import MaskedView from '@react-native-masked-view/masked-view';
import { Button, Popover, type PopoverTriggerRef } from 'heroui-native';
import {
  ArrowUpDown,
  ArrowUpRight,
  Columns2,
  Copy,
  Download,
  Eye,
  Layers,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, FadeInDown, FadeOut, interpolate, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import WebView from 'react-native-webview';

export type WebContextTarget = {
  linkUrl: string | null;
  imageUrl: string | null;
  label: string;
  x: number;
  y: number;
};

export type PreviewRect = { x: number; y: number; width: number; height: number };

export type WebContextAction = 'open' | 'preview' | 'background' | 'copy' | 'split' | 'remove' | 'download';

type ActionItem = { id: WebContextAction; label: string; icon: LucideIcon; destructive?: boolean };

const LINK_ACTIONS: ActionItem[] = [
  { id: 'open', label: 'Open in new tab', icon: ArrowUpRight },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'background', label: 'Open in background', icon: Layers },
  { id: 'copy', label: 'Copy link', icon: Copy },
  { id: 'split', label: 'Open as split view', icon: Columns2 },
];

const ELEMENT_ACTION: ActionItem = { id: 'remove', label: 'Remove element', icon: Trash2, destructive: true };
const IMAGE_ACTION: ActionItem = { id: 'download', label: 'Download image', icon: Download };
const PREVIEW_START_BORDER_RADIUS = 28;
const PREVIEW_BORDER_RADIUS = 42;
const CompatibleMaskedView = MaskedView as unknown as ComponentType<{
  style?: StyleProp<ViewStyle>;
  maskElement: ReactElement;
  androidRenderingMode?: 'software' | 'hardware';
  children?: ReactNode;
}>;

export function WebContextMenu({
  target,
  onAction,
  onDismiss,
}: {
  target: WebContextTarget;
  onAction: (action: WebContextAction, menuRect: PreviewRect | null) => void;
  onDismiss: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<PopoverTriggerRef>(null);
  const menuSurfaceRef = useRef<ComponentRef<typeof View>>(null);
  const menuRectRef = useRef<PreviewRect | null>(null);
  const targetUrl = target.linkUrl ?? target.imageUrl;
  const actions = [
    ...(targetUrl ? LINK_ACTIONS : []),
    ELEMENT_ACTION,
    ...(target.imageUrl ? [IMAGE_ACTION] : []),
  ];

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <View pointerEvents="box-none" style={styles.menuLayer}>
      <Popover
        isOpen={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) onDismiss();
        }}>
        <Popover.Trigger ref={triggerRef} asChild>
          <Pressable
            accessibilityLabel="Link actions anchor"
            onPress={() => setIsOpen(true)}
            style={[styles.contextAnchor, { left: Math.max(1, Math.min(target.x, width - 2)), top: Math.max(1, Math.min(target.y, height - 2)) }]}
          />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Overlay />
          <Popover.Content
            presentation="popover"
            placement="bottom"
            align="start"
            width={Math.min(290, width - 24)}
            insets={{ top: 12, right: 12, bottom: 12, left: 12 }}
            animation={{ entering: FadeInDown.duration(180), exiting: FadeOut.duration(140) }}
            style={styles.menu}>
            <View
              ref={menuSurfaceRef}
              onLayout={() => {
                menuSurfaceRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
                  menuRectRef.current = { x, y, width: measuredWidth, height: measuredHeight };
                });
              }}>
              <ScrollView bounces={false} style={{ maxHeight: Math.min(420, height - 32) }}>
              {target.label ? <Text numberOfLines={1} style={styles.targetLabel}>{target.label}</Text> : null}
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <View key={action.id}>
                    <Button
                      variant="ghost"
                      size="md"
                      onPress={() => {
                        setIsOpen(false);
                        onAction(action.id, menuRectRef.current);
                      }}
                      style={styles.menuItem}>
                      <Icon size={18} color={action.destructive ? '#B64239' : '#373D42'} strokeWidth={1.9} />
                      <Button.Label style={action.destructive ? styles.destructiveText : styles.menuText}>{action.label}</Button.Label>
                    </Button>
                  </View>
                );
              })}
              </ScrollView>
            </View>
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    </View>
  );
}

export function LinkPreviewOverlay({
  uri,
  anchor,
  sourceRect,
  onClose,
}: {
  uri: string | null;
  anchor: { x: number; y: number } | null;
  sourceRect: PreviewRect | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const onCloseRef = useRef(onClose);
  const [isInteractive, setIsInteractive] = useState(false);
  const isClosing = useRef(false);
  onCloseRef.current = onClose;
  const previewWidth = Math.min(width - 36, 520);
  const previewHeight = Math.min(height - 96, 620);
  const left = Math.max(18, Math.min((anchor?.x ?? width / 2) - previewWidth / 2, width - previewWidth - 18));
  const preferredTop = (anchor?.y ?? height / 2) + 22;
  const top = preferredTop + previewHeight > height - 20
    ? Math.max(20, (anchor?.y ?? height / 2) - previewHeight - 22)
    : Math.max(20, preferredTop);
  const from = sourceRect ?? { x: anchor?.x ?? left, y: anchor?.y ?? top, width: 2, height: 2 };
  const squircleRadius = useDerivedValue(() =>
    interpolate(progress.value, [0, 1], [PREVIEW_START_BORDER_RADIUS, PREVIEW_BORDER_RADIUS])
  );
  const shellStyle = useAnimatedStyle(() => ({
    left: interpolate(progress.value, [0, 1], [from.x, left]),
    top: interpolate(progress.value, [0, 1], [from.y, top]),
    width: interpolate(progress.value, [0, 1], [Math.max(2, from.width), previewWidth]),
    height: interpolate(progress.value, [0, 1], [Math.max(2, from.height), previewHeight]),
  }), [from.x, from.y, from.width, from.height, left, top, previewWidth, previewHeight]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.22 }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.58, 0.88, 1], [0, 0, 0.78, 1]),
  }));

  useEffect(() => {
    if (!uri) return;
    isClosing.current = false;
    setIsInteractive(false);
    progress.value = 0;
    progress.value = withTiming(1, { duration: 460, easing: Easing.bezier(0.18, 0.78, 0.24, 1) }, (finished) => {
      if (finished) runOnJS(setIsInteractive)(true);
    });
  }, [uri, progress]);

  function closePreview() {
    if (isClosing.current) return;
    isClosing.current = true;
    setIsInteractive(false);
    progress.value = withTiming(0, { duration: 260, easing: Easing.bezier(0.4, 0, 0.8, 0.25) }, (finished) => {
      if (finished) runOnJS(onCloseRef.current)();
    });
  }

  return (
    <Modal visible={Boolean(uri)} transparent animationType="none" onRequestClose={closePreview} statusBarTranslucent>
      <View style={styles.previewLayer}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.previewBackdrop, backdropStyle]} />
        <Pressable accessibilityLabel="Close preview" onPress={closePreview} style={StyleSheet.absoluteFill} />
        {uri ? (
          <Animated.View pointerEvents={isInteractive ? 'auto' : 'none'} style={[styles.preview, shellStyle]}>
            <CompatibleMaskedView
              style={styles.previewMask}
              androidRenderingMode={Platform.OS === 'android' ? 'software' : undefined}
              maskElement={
                <AnimatedSquircleView
                  animatedSquircleParams={{
                    cornerRadius: squircleRadius,
                    cornerSmoothing: 1,
                    fillColor: '#000000',
                  }}
                  style={styles.previewMaskShape}
                />
              }>
            <Animated.View style={[styles.previewContent, contentStyle]}>
              <WebView
                source={{ uri }}
                style={styles.previewWebView}
                androidLayerType={Platform.OS === 'android' ? 'software' : undefined}
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
              />
            </Animated.View>
            </CompatibleMaskedView>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

export function SplitViewPane({
  uri,
  progress,
  size,
  secondAtTop,
  onSwapOrder,
  onClose,
}: {
  uri: string;
  progress: SharedValue<number>;
  size: SharedValue<number>;
  secondAtTop: boolean;
  onSwapOrder: () => void;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const optionsTriggerRef = useRef<PopoverTriggerRef>(null);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: (height * size.value + 12) * progress.value,
      opacity: progress.value,
    };
  }, [height, secondAtTop]);
  const dividerGesture = Gesture.Pan()
    .minDistance(5)
    .onUpdate((event) => {
      const position = event.absoluteY / height;
      size.value = Math.max(0.25, Math.min(0.75, secondAtTop ? position : 1 - position));
    });

  return (
    <Animated.View style={[styles.splitPane, secondAtTop ? styles.splitPaneTop : styles.splitPaneBottom, animatedStyle]}>
      {secondAtTop ? (
        <>
          <WebView source={{ uri }} style={styles.splitWebView} javaScriptEnabled domStorageEnabled sharedCookiesEnabled />
          <SplitDivider
            gesture={dividerGesture}
            isOptionsOpen={isOptionsOpen}
            setIsOptionsOpen={setIsOptionsOpen}
            triggerRef={optionsTriggerRef}
            onSwapOrder={onSwapOrder}
            onClose={onClose}
          />
        </>
      ) : (
        <>
          <SplitDivider
            gesture={dividerGesture}
            isOptionsOpen={isOptionsOpen}
            setIsOptionsOpen={setIsOptionsOpen}
            triggerRef={optionsTriggerRef}
            onSwapOrder={onSwapOrder}
            onClose={onClose}
          />
          <WebView source={{ uri }} style={styles.splitWebView} javaScriptEnabled domStorageEnabled sharedCookiesEnabled />
        </>
      )}
    </Animated.View>
  );
}

function SplitDivider({
  gesture,
  isOptionsOpen,
  setIsOptionsOpen,
  triggerRef,
  onSwapOrder,
  onClose,
}: {
  gesture: ReturnType<typeof Gesture.Pan>;
  isOptionsOpen: boolean;
  setIsOptionsOpen: (open: boolean) => void;
  triggerRef: React.RefObject<PopoverTriggerRef | null>;
  onSwapOrder: () => void;
  onClose: () => void;
}) {
  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} style={styles.splitDivider}>
        <Popover isOpen={isOptionsOpen} onOpenChange={setIsOptionsOpen}>
          <Popover.Trigger ref={triggerRef} asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Split view options" style={styles.splitHandleTouch}>
              <View style={styles.splitHandlePill} />
            </Pressable>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Overlay />
            <Popover.Content presentation="popover" placement="top" align="center" width={220} style={styles.splitOptions}>
              <Button variant="ghost" size="sm" onPress={() => { setIsOptionsOpen(false); onSwapOrder(); }} style={styles.optionButton}>
                <ArrowUpDown size={17} color="#373D42" />
                <Button.Label>Swap pane order</Button.Label>
              </Button>
              <Button variant="ghost" size="sm" onPress={() => { setIsOptionsOpen(false); onClose(); }} style={styles.optionButton}>
                <X size={17} color="#373D42" />
                <Button.Label>Close split view</Button.Label>
              </Button>
            </Popover.Content>
          </Popover.Portal>
        </Popover>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  menuLayer: { ...StyleSheet.absoluteFill, zIndex: 50 },
  contextAnchor: { position: 'absolute', width: 2, height: 2, backgroundColor: 'transparent' },
  menu: { overflow: 'hidden', borderRadius: 20, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  targetLabel: { paddingHorizontal: 15, paddingTop: 13, paddingBottom: 8, color: '#80868B', fontSize: 12 },
  menuItem: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 12, paddingHorizontal: 14, borderRadius: 9 },
  menuText: { color: '#30363B', fontSize: 14, fontWeight: '500' },
  destructiveText: { color: '#B64239' },
  previewLayer: { flex: 1 },
  previewBackdrop: { backgroundColor: '#14191C' },
  preview: { position: 'absolute', backgroundColor: 'transparent', shadowColor: '#111820', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 18 },
  previewMask: { flex: 1, backgroundColor: 'transparent' },
  previewMaskShape: { flex: 1, backgroundColor: 'transparent' },
  previewContent: { flex: 1 },
  previewWebView: { flex: 1, backgroundColor: '#FFFFFF' },
  splitPane: { position: 'absolute', left: 0, right: 0, zIndex: 8, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  splitPaneTop: { top: 0 },
  splitPaneBottom: { bottom: 0 },
  splitDivider: { height: 12, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#D8DCDE' },
  splitHandleTouch: { width: 56, height: 28, alignItems: 'center', justifyContent: 'center' },
  splitHandlePill: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#727A80' },
  splitOptions: { gap: 3, padding: 5, borderRadius: 13, backgroundColor: '#FFFFFF' },
  optionButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10, paddingHorizontal: 10, borderRadius: 9 },
  splitWebView: { flex: 1, backgroundColor: '#FFFFFF' },
});
