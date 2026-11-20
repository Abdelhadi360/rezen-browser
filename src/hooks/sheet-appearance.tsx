import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const SHEET_APPEARANCE_KEY = 'thermal.browser.sheet-appearance.v1';

export type SheetAppearance = 'normal' | 'blur';

const SheetAppearanceContext = createContext<{
  appearance: SheetAppearance;
  setAppearance: (appearance: SheetAppearance) => void;
}>({ appearance: 'normal', setAppearance: () => undefined });

export function SheetAppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<SheetAppearance>('normal');

  useEffect(() => {
    AsyncStorage.getItem(SHEET_APPEARANCE_KEY).then((saved) => {
      if (saved === 'normal' || saved === 'blur') setAppearanceState(saved);
    }).catch(() => undefined);
  }, []);

  function setAppearance(nextAppearance: SheetAppearance) {
    setAppearanceState(nextAppearance);
    AsyncStorage.setItem(SHEET_APPEARANCE_KEY, nextAppearance).catch(() => undefined);
  }

  return (
    <SheetAppearanceContext.Provider value={{ appearance, setAppearance }}>
      {children}
    </SheetAppearanceContext.Provider>
  );
}

export function useSheetAppearance() {
  return useContext(SheetAppearanceContext);
}