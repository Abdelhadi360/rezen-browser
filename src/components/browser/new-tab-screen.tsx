import { Image } from 'expo-image';
import { MeshGradientView } from 'expo-mesh-gradient';
import { router } from 'expo-router';
import { BottomSheet, Button } from 'heroui-native';
import { PanelsTopLeft, Plus, Settings } from 'lucide-react-native';
import type { ComponentProps, ComponentRef } from 'react';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SearchProviderId } from './search-provider-picker';
import { SearchProviderPicker, type SearchProvider } from './search-provider-picker';
import type { BrowserTab } from './types';

const GRADIENT_COLORS = [
  '#FCFCFA', '#FAFBF7', '#F7F9F2',
  '#F5F7EF', '#F1F4E9', '#EEF1E5',
  '#F8F9F4', '#F4F6EE', '#F0F3E8',
];

const GRADIENT_POINTS = [
  [0, 0], [0.7, 0], [1, 0],
  [0, 0.5], [0.5, 0.5], [1, 0.5],
  [0, 1], [0.5, 1], [1, 1],
];

type NewTabScreenProps = {
  motionStyle: ComponentProps<typeof Animated.View>['style'];
  recentTabs: BrowserTab[];
  onOpenRecentTabs: () => void;
  onSelectRecentTab: (tab: BrowserTab) => void;
  addressDraft: string;
  onAddressChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  addressInputRef: React.RefObject<ComponentRef<typeof TextInput> | null>;
  providerId: SearchProviderId | null;
  providerPopoverOpen: boolean;
  onProviderPopoverChange: (isOpen: boolean) => void;
  providerTriggerRef: React.RefObject<import('heroui-native').PopoverTriggerRef | null>;
  providerQuery: string;
  onChooseProvider: (provider: SearchProvider) => void;
  onCancelProviderSearch: () => void;
};

export function NewTabScreen({
  motionStyle,
  recentTabs,
  onOpenRecentTabs,
  onSelectRecentTab,
  addressDraft,
  onAddressChange,
  onSubmit,
  onFocus,
  onBlur,
  addressInputRef,
  providerId,
  providerPopoverOpen,
  onProviderPopoverChange,
  providerTriggerRef,
  providerQuery,
  onChooseProvider,
  onCancelProviderSearch,
}: NewTabScreenProps) {
  const insets = useSafeAreaInsets();
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);

  useEffect(() => {
    if (!isSearchSheetOpen) return;
    const timer = setTimeout(() => addressInputRef.current?.focus(), 240);
    return () => clearTimeout(timer);
  }, [addressInputRef, isSearchSheetOpen]);

  function handleSearchSheetChange(isOpen: boolean) {
    setIsSearchSheetOpen(isOpen);
    if (!isOpen) {
      Keyboard.dismiss();
      addressInputRef.current?.blur();
    }
  }

  return (
    <Animated.View style={[styles.homeScreen, motionStyle]}>
      <MeshGradientView
        style={StyleSheet.absoluteFill}
        columns={3}
        rows={3}
        colors={GRADIENT_COLORS}
        points={GRADIENT_POINTS}
        smoothsColors
      />

      <View style={[styles.bottomBar, { bottom: insets.bottom + 12 }]}>
        <View style={styles.tabStack}>
          {([1, 0] as const).map((stackPosition) => {
            const tab = recentTabs[stackPosition];
            return (
              <Pressable
                key={stackPosition}
                accessibilityRole="button"
                accessibilityLabel={tab ? `Open ${tab.title}` : 'Open recent tabs'}
                onPress={() => tab ? onSelectRecentTab(tab) : onOpenRecentTabs()}
                style={[styles.tabPreview, stackPosition === 1 ? styles.backTabPreview : styles.frontTabPreview]}>
                {tab?.thumbnail ? (
                  <Image source={{ uri: tab.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={styles.emptyTabPreview}>
                    <PanelsTopLeft size={15} color="#62636C" strokeWidth={2.2} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <BottomSheet isOpen={isSearchSheetOpen} onOpenChange={handleSearchSheetChange}>
          <BottomSheet.Trigger asChild>
            <Button
              variant="secondary"
              size="sm"
              isIconOnly
              accessibilityLabel="New search"
              onPress={() => setIsSearchSheetOpen(true)}
              style={styles.newTabButton}>
              <Plus size={28} color="#18181A" strokeWidth={2.2} />
            </Button>
          </BottomSheet.Trigger>
          <BottomSheet.Portal>
            <BottomSheet.Overlay style={styles.sheetOverlay} />
            <BottomSheet.Content
              snapPoints={['82%']}
              enableDynamicSizing={false}
              keyboardBehavior="interactive"
              contentContainerClassName="h-full px-5 pt-[18px]"
              backgroundClassName="rounded-t-[28px]">
              <View style={styles.searchField}>
                <TextInput
                  ref={addressInputRef}
                  value={addressDraft}
                  onChangeText={onAddressChange}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  onSubmitEditing={({ nativeEvent }) => {
                    Keyboard.dismiss();
                    setIsSearchSheetOpen(false);
                    onSubmit(nativeEvent.text);
                  }}
                  placeholder="Search..."
                  placeholderTextColor="#888A8E"
                  returnKeyType="go"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  accessibilityLabel="Search or enter a website address"
                  style={styles.searchInput}
                />
                <SearchProviderPicker
                  providerId={providerId}
                  isOpen={providerPopoverOpen}
                  onOpenChange={onProviderPopoverChange}
                  triggerRef={providerTriggerRef}
                  query={providerQuery}
                  onChoose={onChooseProvider}
                  onCancel={onCancelProviderSearch}
                  placement="bottom"
                  compact
                />
              </View>
            </BottomSheet.Content>
          </BottomSheet.Portal>
        </BottomSheet>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
          <Settings size={24} color="#171719" strokeWidth={1.7} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  homeScreen: { flex: 1, overflow: 'hidden', backgroundColor: '#F7F7F2' },
  bottomBar: { position: 'absolute', left: '14%', right: '14%', height: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabStack: { width: 66, height: 70, position: 'relative' },
  tabPreview: { position: 'absolute', width: 43, height: 60, overflow: 'hidden', borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.76)', shadowColor: '#433A5D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 3 },
  backTabPreview: { left: 18, top: 1, transform: [{ rotate: '10deg' }] },
  frontTabPreview: { left: 2, top: 8, transform: [{ rotate: '-9deg' }] },
  emptyTabPreview: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.42)' },
  newTabButton: { width: 88, height: 50, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.96)', backgroundColor: 'rgba(255,255,255,0.9)', shadowColor: '#645873', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 },
  settingsButton: { width: 56, height: 64, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },
  sheetOverlay: { backgroundColor: 'rgba(37, 34, 47, 0.58)' },
  searchField: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, borderRadius: 34, backgroundColor: '#FFFFFF' },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 10, color: '#36373A', fontSize: 20, fontWeight: '400' },
});