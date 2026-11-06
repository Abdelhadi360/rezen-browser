import { Image } from 'expo-image';
import { Button } from 'heroui-native';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { BrowserGlyph } from './browser-icons';
import type { BrowserTab } from './types';

type RecentTabsScreenProps = {
  tabs: BrowserTab[];
  recentTabs: BrowserTab[];
  screenWidth: number;
  cardWidth: number;
  cardHeight: number;
  topInset: number;
  bottomInset: number;
  onScroll: ComponentProps<typeof Animated.ScrollView>['onScroll'];
  onSelect: (tab: BrowserTab) => void;
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
  topInset,
  bottomInset,
  onScroll,
  onSelect,
  onNewTab,
  onDone,
  onCloseAll,
}: RecentTabsScreenProps) {
  const contentPadding = useMemo(() => (screenWidth - cardWidth) / 2, [screenWidth, cardWidth]);

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
            style={styles.carousel}
            contentContainerStyle={[styles.carouselContent, { paddingHorizontal: contentPadding }]}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + 16}
            decelerationRate="fast"
            disableIntervalMomentum
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled">
            {recentTabs.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                accessibilityLabel={`Open ${tab.title}`}
                onPress={() => onSelect(tab)}
                style={[styles.tabWindow, { width: cardWidth, height: cardHeight, backgroundColor: safePageColor(tab.pageSurfaceColor ?? '#F3F4F5') }]}
              >
                {tab.thumbnail ? <Image source={{ uri: tab.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </Button>
            ))}
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
  carousel: { flex: 1 },
  carouselContent: { flexGrow: 1, alignItems: 'center', gap: 16 },
  tabWindow: { overflow: 'hidden', padding: 0, marginRight: 0, borderRadius: 24, backgroundColor: 'transparent' },
  emptyTabs: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTabsMark: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECEDEF' },
  emptyTabsTitle: { color: '#353A3F', fontSize: 15, fontWeight: '600' },
  emptyTabsButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, paddingHorizontal: 16, borderRadius: 21 },
  footer: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20 },
  footerButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 22 },
  newTabButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 17, borderRadius: 24 },
});