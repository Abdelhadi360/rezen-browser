import { Image } from 'expo-image';
import { Button, Popover, type PopoverTriggerRef } from 'heroui-native';
import { ScanSearch, X } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

export type SearchProviderId = 'google' | 'bing' | 'duckduckgo' | 'wikipedia' | 'perplexity' | 'chatgpt';
export type SearchProvider = { id: SearchProviderId; name: string; domain: string };

export const SEARCH_PROVIDERS: SearchProvider[] = [
  { id: 'google', name: 'Google', domain: 'google.com' },
  { id: 'bing', name: 'Bing', domain: 'bing.com' },
  { id: 'duckduckgo', name: 'DuckDuckGo', domain: 'duckduckgo.com' },
  { id: 'wikipedia', name: 'Wikipedia', domain: 'wikipedia.org' },
  { id: 'perplexity', name: 'Perplexity', domain: 'perplexity.ai' },
  { id: 'chatgpt', name: 'ChatGPT', domain: 'chatgpt.com' },
];

export function searchProviderUrl(query: string, providerId: SearchProviderId) {
  const encodedQuery = encodeURIComponent(query.trim());
  switch (providerId) {
    case 'google': return `https://www.google.com/search?q=${encodedQuery}`;
    case 'bing': return `https://www.bing.com/search?q=${encodedQuery}`;
    case 'duckduckgo': return `https://duckduckgo.com/?q=${encodedQuery}`;
    case 'wikipedia': return `https://en.wikipedia.org/w/index.php?search=${encodedQuery}`;
    case 'perplexity': return `https://www.perplexity.ai/search?q=${encodedQuery}`;
    case 'chatgpt': return `https://chatgpt.com/?q=${encodedQuery}`;
  }
}

export function SearchProviderPicker({
  providerId,
  isOpen,
  onOpenChange,
  triggerRef,
  query,
  onChoose,
  onCancel,
  placement,
  compact = false,
}: {
  providerId: SearchProviderId | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  triggerRef: React.RefObject<PopoverTriggerRef | null>;
  query: string;
  onChoose: (provider: SearchProvider) => void;
  onCancel: () => void;
  placement: 'top' | 'bottom';
  compact?: boolean;
}) {
  const provider = SEARCH_PROVIDERS.find((item) => item.id === providerId);
  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger ref={triggerRef} asChild>
        <Button
          variant="secondary"
          size="sm"
          accessibilityLabel={isOpen && !provider ? 'Cancel provider search' : provider ? `Search with ${provider.name}` : 'Choose a search provider'}
          onPress={isOpen && !provider ? onCancel : undefined}
          style={[styles.providerBadge, compact && styles.compactBadge, !provider && !isOpen && styles.emptyBadge]}>
          {provider ? (
            <>
              <ProviderLogo provider={provider} size={compact ? 16 : 18} />
              <Button.Label style={styles.providerLabel}>{provider.name}</Button.Label>
            </>
          ) : isOpen ? <X size={compact ? 14 : 16} color="#4D555B" /> : compact ? <ScanSearch size={22} color="#85878B" strokeWidth={2.2} /> : null}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Overlay />
        <Popover.Content
          presentation="popover"
          placement={placement}
          align="start"
          offset={24}
          avoidCollisions
          width={250}
          background={null}
          style={styles.providerPopover}>
          <ProviderRecommendations query={query} onChoose={onChoose} />
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}

function ProviderLogo({ provider, size }: { provider: SearchProvider; size: number }) {
  return (
    <Image
      source={{ uri: `https://www.google.com/s2/favicons?domain=${provider.domain}&sz=64` }}
      style={{ width: size, height: size, borderRadius: 5 }}
      contentFit="contain"
    />
  );
}

function ProviderRecommendations({
  query,
  onChoose,
}: {
  query: string;
  onChoose: (provider: SearchProvider) => void;
}) {
  const matches = SEARCH_PROVIDERS.filter((provider) => provider.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <View style={styles.recommendations}>
      {matches.length ? matches.map((provider) => (
        <Button key={provider.id} variant="ghost" size="sm" onPress={() => onChoose(provider)} style={styles.providerOption}>
          <ProviderLogo provider={provider} size={18} />
          <Button.Label>{provider.name}</Button.Label>
        </Button>
      )) : <Text style={styles.noResults}>No matching providers</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  providerBadge: { minWidth: 32, maxWidth: 118, height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 7, borderRadius: 17, backgroundColor: '#EEF0F1' },
  emptyBadge: { backgroundColor: 'transparent' },
  compactBadge: { minWidth: 28, maxWidth: 94, height: 28, gap: 4, paddingHorizontal: 4, borderRadius: 14 },
  providerLabel: { fontSize: 12 },
  providerPopover: { backgroundColor: '#FFFFFF', zIndex: 50 },
  recommendations: { gap: 2 },
  providerOption: { minHeight: 42, flexDirection: 'row', justifyContent: 'flex-start', gap: 10, paddingHorizontal: 10, borderRadius: 10 },
  noResults: { paddingHorizontal: 10, paddingVertical: 12, color: '#747A80', fontSize: 13 },
});