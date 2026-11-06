import { BottomSheet, Button, type PopoverTriggerRef } from 'heroui-native';
import type { ComponentRef, RefObject } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { BrowserGlyph } from './browser-icons';
import { WebsiteColorControls, type WebsiteColorTarget } from './page-color-controls';
import type { SearchProviderId } from './search-provider-picker';
import { SearchProviderPicker, type SearchProvider } from './search-provider-picker';
import SquircleSurface from './squircle-surface';
import type { BrowserTab } from './types';

type PageAddressBarProps = {
  tab: BrowserTab;
  addressValue: string;
  isEditing: boolean;
  isLoading: boolean;
  toolbarTextColor: string;
  pageBarColor: string;
  canGoBack: boolean;
  canGoForward: boolean;
  selectedProvider: SearchProviderId | null;
  providerPopoverOpen: boolean;
  providerQuery: string;
  providerTriggerRef: React.RefObject<PopoverTriggerRef | null>;
  onCancelProviderSearch: () => void;
  blurTargetRef: RefObject<ComponentRef<typeof View> | null>;
  overflowOpen: boolean;
  colorTarget: WebsiteColorTarget;
  colorValue: string;
  addressInputRef: React.RefObject<ComponentRef<typeof TextInput> | null>;
  onAddressChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: (value: string) => void;
  onProviderPopoverChange: (isOpen: boolean) => void;
  onChooseProvider: (provider: SearchProvider) => void;
  onOverflowChange: (isOpen: boolean) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onRefresh: () => void;
  onColorTargetChange: (target: WebsiteColorTarget) => void;
  onColorChange: (color: string) => void;
  onColorReset: () => void;
};

export function PageAddressBar({
  tab,
  addressValue,
  isEditing,
  isLoading,
  toolbarTextColor,
  pageBarColor,
  canGoBack,
  canGoForward,
  selectedProvider,
  providerPopoverOpen,
  providerQuery,
  providerTriggerRef,
  onCancelProviderSearch,
  blurTargetRef,
  overflowOpen,
  colorTarget,
  colorValue,
  addressInputRef,
  onAddressChange,
  onFocus,
  onBlur,
  onSubmit,
  onProviderPopoverChange,
  onChooseProvider,
  onOverflowChange,
  onGoBack,
  onGoForward,
  onRefresh,
  onColorTargetChange,
  onColorChange,
  onColorReset,
}: PageAddressBarProps) {
  return (
    <View style={[styles.address, { backgroundColor: pageBarColor }]}>
      <SearchProviderPicker
        providerId={selectedProvider}
        isOpen={providerPopoverOpen}
        onOpenChange={onProviderPopoverChange}
        triggerRef={providerTriggerRef}
        query={providerQuery}
        onChoose={onChooseProvider}
        onCancel={onCancelProviderSearch}
        placement="top"
        compact
      />
      {isLoading ? <ActivityIndicator size="small" color={toolbarTextColor} /> : null}
      <TextInput
        ref={addressInputRef}
        value={isEditing ? addressValue : tab.url ?? ''}
        onChangeText={onAddressChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={({ nativeEvent }) => onSubmit(nativeEvent.text)}
        placeholder="Search or enter an address"
        placeholderTextColor="#858B90"
        returnKeyType="go"
        autoCapitalize="none"
        autoCorrect={false}
        selectTextOnFocus
        keyboardType="url"
        style={[styles.addressInput, { color: toolbarTextColor }]}
        accessibilityLabel="Website address"
      />
      <BottomSheet isOpen={overflowOpen} onOpenChange={onOverflowChange}>
        <BottomSheet.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            accessibilityLabel="More browser actions"
            accessibilityState={{ expanded: overflowOpen }}
            style={styles.overflowTrigger}>
            <BrowserGlyph name="ellipsis" size={18} color={toolbarTextColor} />
          </Button>
        </BottomSheet.Trigger>
        <BottomSheet.Portal>
          <BottomSheet.Overlay
            variant="blur"
            blurViewProps={{
              blurTarget: blurTargetRef,
              blurMethod: 'dimezisBlurViewSdk31Plus',
              intensity: 36,
              tint: 'light',
            } as never}
          />
          <BottomSheet.Content
            snapPoints={['90%']}
            enableDynamicSizing={false}
            contentContainerClassName="h-full"
            backgroundClassName="rounded-t-[28px]">
            <View style={styles.sheetContent}>
              <View style={styles.sheetHeader}>
                <BottomSheet.Title style={styles.sheetTitle}>Page appearance</BottomSheet.Title>
                <BottomSheet.Close />
              </View>
            <View style={styles.overflowActions}>
              <Button variant="secondary" size="sm" isIconOnly accessibilityLabel="Go back" isDisabled={!canGoBack} onPress={onGoBack} style={styles.popoverAction}>
                <BrowserGlyph name="chevron-left" size={17} color="#30353A" />
              </Button>
              <Button variant="secondary" size="sm" isIconOnly accessibilityLabel="Go forward" isDisabled={!canGoForward} onPress={onGoForward} style={styles.popoverAction}>
                <BrowserGlyph name="chevron-right" size={17} color="#30353A" />
              </Button>
              <Button variant="secondary" size="sm" isIconOnly accessibilityLabel="Refresh page" onPress={onRefresh} style={styles.popoverAction}>
                <BrowserGlyph name="rotate-cw" size={17} color="#30353A" />
              </Button>
            </View>
            <View style={styles.popoverDivider} />
            <SquircleSurface cornerSmoothing={0.82} style={styles.colorControlsSurface}>
              <WebsiteColorControls
                target={colorTarget}
                color={colorValue}
                onTargetChange={onColorTargetChange}
                onColorChange={onColorChange}
                onReset={onColorReset}
              />
            </SquircleSurface>
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  address: { flex: 1, minWidth: 0, height: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderRadius: 24, backgroundColor: '#F3F4F5' },
  addressInput: { flex: 1, paddingVertical: 8, color: '#292D31', fontSize: 13 },
  overflowTrigger: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheetContent: { flex: 1, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28, gap: 14 },
  sheetHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: '#252A2E', fontSize: 18, fontWeight: '700' },
  overflowActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  popoverAction: { flex: 1, height: 44, minHeight: 44, borderRadius: 12 },
  popoverDivider: { height: 1, marginVertical: 11, backgroundColor: '#E7E9EA' },
  colorControlsSurface: { padding: 14, borderRadius: 22, backgroundColor: '#F6F7F7', overflow: 'hidden' },
});
