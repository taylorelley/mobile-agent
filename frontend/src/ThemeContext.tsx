import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeMode, ColorScheme, resolveTheme } from './theme';

type ThemeContextType = {
  mode: ThemeMode;
  colors: ColorScheme;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  colors: Colors.dark,
  resolved: 'dark',
  setMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem('theme_mode', newMode);
  }, []);

  const resolved = resolveTheme(mode, systemScheme);
  const colors = Colors[resolved];

  return (
    <ThemeContext.Provider value={{ mode, colors, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
