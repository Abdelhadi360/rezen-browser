import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Button, Label, Radio, RadioGroup } from 'heroui-native';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SEARCH_ENGINE_KEY = 'thermal.browser.search-engine.v1';
const SEARCH_ENGINES = ['Google', 'DuckDuckGo', 'Bing'] as const;
type SearchEngine = (typeof SEARCH_ENGINES)[number];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [searchEngine, setSearchEngine] = useState<SearchEngine>('Google');

  useEffect(() => {
    AsyncStorage.getItem(SEARCH_ENGINE_KEY).then((saved) => {
      if (SEARCH_ENGINES.includes(saved as SearchEngine)) setSearchEngine(saved as SearchEngine);
    }).catch(() => undefined);
  }, []);

  function chooseSearchEngine(engine: SearchEngine) {
    setSearchEngine(engine);
    AsyncStorage.setItem(SEARCH_ENGINE_KEY, engine).catch(() => undefined);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Button variant="ghost" size="sm" isIconOnly accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={19} color="#454B50" strokeWidth={2} />
        </Button>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerBalance} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search</Text>
        <Text style={styles.description}>Choose where searches from the address field go.</Text>
        <RadioGroup
          value={searchEngine}
          onValueChange={(engine) => {
            if (SEARCH_ENGINES.includes(engine as SearchEngine)) chooseSearchEngine(engine as SearchEngine);
          }}
          style={styles.options}>
          {SEARCH_ENGINES.map((engine) => {
            const selected = searchEngine === engine;
            return (
              <RadioGroup.Item
                key={engine}
                value={engine}
                style={[styles.option, selected && styles.optionSelected]}>
                <Label>{engine}</Label>
                <Radio />
              </RadioGroup.Item>
            );
          })}
        </RadioGroup>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Button
          variant="secondary"
          onPress={() => router.push('/onboarding' as never)}
          style={styles.gradientButton}>
          <Text style={styles.gradientButtonText}>Show onboarding</Text>
          <ArrowRight size={17} color="#41464A" strokeWidth={2} />
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 22, backgroundColor: '#FFFFFF' },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerBalance: { width: 42 },
  title: { color: '#24282C', fontSize: 18, fontWeight: '700' },
  section: { marginTop: 31 },
  sectionTitle: { color: '#353A3F', fontSize: 13, fontWeight: '700' },
  description: { marginTop: 5, marginBottom: 13, color: '#7A8085', fontSize: 12, lineHeight: 18 },
  options: { overflow: 'hidden', borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7E9' },
  option: { minHeight: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E9EAEC' },
  optionSelected: { backgroundColor: '#F7F8F9' },
  optionText: { color: '#62686D', fontSize: 14 },
  optionTextSelected: { color: '#30353A', fontWeight: '600' },
  gradientButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderRadius: 10 },
  gradientButtonText: { color: '#353A3F', fontSize: 14, fontWeight: '600' },
});