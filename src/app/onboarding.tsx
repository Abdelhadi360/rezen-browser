import { router } from 'expo-router';

import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';

export default function OnboardingRoute() {
  return <OnboardingScreen onFinish={() => router.back()} />;
}