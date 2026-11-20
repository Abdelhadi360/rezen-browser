import { BlurView } from 'expo-blur';
import { BottomSheet } from 'heroui-native';
import type { ComponentRef, RefObject } from 'react';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { useSheetAppearance } from '../../hooks/sheet-appearance';

export type FontSelectionInfo = {
  family: string;
  weight: string;
  style: string;
  text: string;
  variants: { weight: string; style: string }[];
};

export function FontInfoSheet({
  font,
  isOpen,
  blurTargetRef,
  onOpenChange,
}: {
  font: FontSelectionInfo | null;
  isOpen: boolean;
  blurTargetRef: RefObject<ComponentRef<typeof View> | null>;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const { appearance } = useSheetAppearance();
  const useBlur = appearance === 'blur' && Platform.OS === 'android';
  const [expanded, setExpanded] = useState(false);

  const variants = font?.variants.length ? font.variants : [{ weight: font?.weight ?? '400', style: font?.style ?? 'normal' }];

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={['52%', '90%']}
          enableDynamicSizing={false}
          onChange={(index) => setExpanded(index > 0)}
          contentContainerClassName="h-full px-5 pt-4"
          backgroundClassName={useBlur ? 'rounded-t-[28px] bg-transparent' : 'rounded-t-[28px]'}>
          {useBlur ? (
            <BlurView
              blurTarget={blurTargetRef}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={72}
              tint="light"
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.heading}>
                <BottomSheet.Title style={styles.title}>About font</BottomSheet.Title>
                <Text numberOfLines={1} style={styles.family}>{font?.family ?? 'Unknown font'}</Text>
              </View>
              <BottomSheet.Close />
            </View>
            {font ? (
              <>
                <Text numberOfLines={2} style={styles.selectedText}>{font.text}</Text>
                {expanded ? (
                  <ScrollView contentContainerStyle={styles.variantList} showsVerticalScrollIndicator={false}>
                    {variants.map((variant) => {
                      const weight = normalizeWeight(variant.weight);
                      const style = variant.style === 'italic' || variant.style === 'oblique' ? 'italic' : 'normal';
                      return (
                        <View key={`${variant.weight}-${variant.style}`} style={styles.variantRow}>
                          <Text style={styles.variantLabel}>{weightLabel(weight)}{style === 'italic' ? ' Italic' : ''}</Text>
                          <Text
                            numberOfLines={1}
                            style={[styles.variantSample, { fontWeight: weight, fontStyle: style } as TextStyle]}>
                            {font.text || 'The quick brown fox jumps over the lazy dog'}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <View style={styles.expandHint}>
                    <Text style={styles.hintText}>Expand to view available styles</Text>
                  </View>
                )}
              </>
            ) : null}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

function normalizeWeight(weight: string): TextStyle['fontWeight'] {
  const parsed = Number.parseInt(weight, 10);
  if (Number.isFinite(parsed)) return String(Math.max(100, Math.min(900, Math.round(parsed / 100) * 100))) as TextStyle['fontWeight'];
  if (weight === 'bold') return '700';
  return '400';
}

function weightLabel(weight: TextStyle['fontWeight']) {
  const labels: Record<string, string> = {
    '100': 'Thin', '200': 'Extra light', '300': 'Light', '400': 'Regular',
    '500': 'Medium', '600': 'Semi bold', '700': 'Bold', '800': 'Extra bold', '900': 'Black',
  };
  return labels[String(weight)] ?? 'Regular';
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading: { flex: 1, gap: 3 },
  title: { color: '#22272B', fontSize: 20, fontWeight: '700' },
  family: { color: '#6A7177', fontSize: 13 },
  selectedText: { padding: 14, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(125,132,138,0.10)', color: '#22272B', fontSize: 16 },
  variantList: { gap: 12, paddingBottom: 22 },
  variantRow: { minHeight: 54, gap: 3 },
  variantLabel: { color: '#777E84', fontSize: 11, fontWeight: '600' },
  variantSample: { color: '#24292D', fontSize: 17 },
  expandHint: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hintText: { color: '#737A80', fontSize: 13 },
});