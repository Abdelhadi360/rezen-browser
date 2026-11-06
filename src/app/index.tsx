import { BrowserScreen } from '@/components/browser/browser-screen';
import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const ONBOARDING_KEY = 'thermal.onboarding.completed.v1';

export default function HomeScreen() {
  const [isReady, setIsReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((completed) => setNeedsOnboarding(completed !== 'true'))
      .catch(() => setNeedsOnboarding(true))
      .finally(() => setIsReady(true));
  }, []);

  if (!isReady) return <View style={styles.loading} />;
  if (needsOnboarding) return <OnboardingScreen onFinish={() => setNeedsOnboarding(false)} />;
  return <BrowserScreen />;
}

const styles = StyleSheet.create({ loading: { flex: 1, backgroundColor: '#FFFFFF' } });
