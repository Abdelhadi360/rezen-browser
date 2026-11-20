import { Image } from 'expo-image';
import { Button } from 'heroui-native';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { BrowserGlyph } from './browser-icons';
import type { BrowserTab } from './types';

type RecentTabsScreenProps = {
  tabs: BrowserTab[];
  recentTabs: BrowserTab[];
  screenWidth: number;
  cardWidth: number;
  cardHeight: number;
  transitioning: boolean;
  topInset: number;
  bottomInset: number;
  onScroll: ComponentProps<typeof Animated.ScrollView>['onScroll'];
  onSelect: (tab: BrowserTab) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onDone: () => void;
  onCloseAll: () => void;
};

export function RecentTabsScreen({
  tabs,
  recentTabs,
  screenWidth,
  cardWidth,
  cardHeight,
  transitioning,
  topInset,
  bottomInset,
  onScroll,
  onSelect,
  onCloseTab,
  onNewTab,
  onDone,
  onCloseAll,
}: RecentTabsScreenProps) {
  const [centeredIndex, setCenteredIndex] = useState(0);
  const itemWidth = Math.min(cardWidth, screenWidth - 40);
  const sideInset = (screenWidth - itemWidth) / 2;
  const snapInterval = itemWidth * 0.62;

  return (
    <View style={styles.root}>
      <View style={[styles.sheet, { paddingTop: topInset + 8, paddingBottom: bottomInset + 16 }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Recent tabs</Text>
            <Text style={styles.subtitle}>{tabs.length} {tabs.length === 1 ? 'window' : 'windows'}</Text>
          </View>
          <View style={styles.actions}>
            <RecentIconButton label="New tab" icon="plus" onPress={onNewTab} />
            <RecentIconButton label="Done" icon="close" onPress={onDone} />
          </View>
        </View>
        {tabs.length === 0 ? (
          <View style={styles.emptyTabs}>
            <View style={styles.emptyTabsMark}><BrowserGlyph name="panels-top-left" size={24} color="#555C61" /></View>
            <Text style={styles.emptyTabsTitle}>No recent tabs</Text>
            <Button variant="primary" size="sm" onPress={onNewTab} style={styles.emptyTabsButton}>
              <BrowserGlyph name="plus" size={17} color="#FFFFFF" />
              <Button.Label>New tab</Button.Label>
            </Button>
          </View>
        ) : (
          <Animated.ScrollView
            horizontal
            style={styles.stack}
            contentContainerStyle={styles.stackContent}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bounces={false}
            onScroll={onScroll}
            onMomentumScrollEnd={(event) => setCenteredIndex(Math.round(event.nativeEvent.contentOffset.x / snapInterval))}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={snapInterval}
            snapToAlignment="start"
            keyboardShouldPersistTaps="handled">
            <View style={{ width: sideInset }} />
            {recentTabs.map((tab, index) => (
              <RecentTabCard
                key={tab.id}
                tab={tab}
                index={index}
                count={recentTabs.length}
                centeredIndex={centeredIndex}
                transitioning={transitioning}
                width={itemWidth}
                height={cardHeight}
                onSelect={onSelect}
                onClose={onCloseTab}
              />
            ))}
            <View style={{ width: sideInset }} />
          </Animated.ScrollView>
        )}
        <View style={styles.footer}>
          <Button
            variant="secondary"
            size="sm"
            accessibilityLabel="Close all tabs"
            isDisabled={tabs.length === 0}
            onPress={onCloseAll}
            style={styles.footerButton}>
            <BrowserGlyph name="close" size={16} color="#626970" />
            <Button.Label>Close all</Button.Label>
          </Button>
          <Button variant="primary" size="sm" accessibilityLabel="New tab" onPress={onNewTab} style={[styles.footerButton, styles.newTabButton]}>
            <BrowserGlyph name="plus" size={18} color="#FFFFFF" />
            <Button.Label>New tab</Button.Label>
          </Button>
        </View>
      </View>
    </View>
  );
}

function RecentTabCard({
  tab,
  index,
  count,
  centeredIndex,
  transitioning,
  width,
  height,
  onSelect,
  onClose,
}: {
  tab: BrowserTab;
  index: number;
  count: number;
  centeredIndex: number;
  transitioning: boolean;
  width: number;
  height: number;
  onSelect: (tab: BrowserTab) => void;
  onClose: (tabId: string) => void;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  const swipeToClose = Gesture.Pan()
    .activeOffsetY(-10)
    .failOffsetX([-20, 20])
    .onUpdate((event) => {
      translateY.value = Math.min(0, event.translationY);
      opacity.value = Math.max(0.35, 1 + event.translationY / height);
    })
    .onEnd((event) => {
      if (event.translationY < -72 || event.velocityY < -700) {
        translateY.value = withTiming(-height, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onClose)(tab.id);
        });
        opacity.value = withTiming(0, { duration: 160 });
      } else {
        translateY.value = withTiming(0, { duration: 160 });
        opacity.value = withTiming(1, { duration: 160 });
      }
    });

  return (
    <GestureDetector gesture={swipeToClose}>
      <Animated.View
        layout={LinearTransition.duration(180)}
        style={[
          styles.tabWindow,
          animatedStyle,
          { width, height, zIndex: index === centeredIndex ? count + 1 : count - Math.abs(index - centeredIndex), marginRight: index === count - 1 ? 0 : -width * 0.38, opacity: transitioning ? 0 : undefined },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${tab.title}`}
          onPress={() => onSelect(tab)}
          style={[styles.tabPreview, { backgroundColor: safePageColor(tab.pageSurfaceColor ?? '#F3F4F5') }]}>
          {tab.thumbnail ? <Image source={{ uri: tab.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <View style={styles.tabTitle}><Text numberOfLines={1} style={styles.tabTitleText}>{tab.title}</Text></View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

function RecentIconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: 'plus' | 'close';
  onPress: () => void;
}) {
  return (
    <Button variant="secondary" size="sm" isIconOnly accessibilityLabel={label} onPress={onPress} style={styles.iconButton}>
      <BrowserGlyph name={icon} />
    </Button>
  );
}

function safePageColor(value: string) {
  const color = value.trim();
  if (/^#[\da-f]{3,4}(?:[\da-f]{3,4})?$/i.test(color)) return color;
  if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)$/i.test(color)) return color;
  return '#FFFFFF';
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 10, backgroundColor: 'transparent' },
  sheet: { flex: 1, backgroundColor: 'transparent' },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  title: { color: '#202428', fontSize: 24, fontWeight: '700' },
  subtitle: { marginTop: 3, color: '#777D82', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 6 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F2F3' },
  stack: { flex: 1 },
  stackContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  tabWindow: { overflow: 'hidden', borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E6E8', elevation: 4, shadowColor: '#252B31', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.14, shadowRadius: 12 },
  tabPreview: { flex: 1, overflow: 'hidden', borderRadius: 23 },
  tabTitle: { position: 'absolute', top: 10, left: 10, right: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.88)' },
  tabTitleText: { color: '#30353A', fontSize: 12, fontWeight: '600' },
  emptyTabs: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTabsMark: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECEDEF' },
  emptyTabsTitle: { color: '#353A3F', fontSize: 15, fontWeight: '600' },
  emptyTabsButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, paddingHorizontal: 16, borderRadius: 21 },
  footer: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20 },
  footerButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 22 },
  newTabButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 17, borderRadius: 24 },
});