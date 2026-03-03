import { useColorScheme as useSystemColorScheme } from 'react-native';

export const Colors = {
  light: {
    background: '#F0F2F5',
    surface: '#FFFFFF',
    surfaceHighlight: '#E1E4E8',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    primary: '#FF4500',
    primaryForeground: '#FFFFFF',
    secondary: '#06B6D4',
    accent: '#F59E0B',
    destructive: '#EF4444',
    border: '#E2E8F0',
    success: '#10B981',
    inputBg: '#F8FAFC',
    bubbleUser: '#FF4500',
    bubbleAi: '#FFFFFF',
    bubbleAiBorder: '#E2E8F0',
    actionCardBg: '#E1E4E8',
    actionCardBorder: '#06B6D4',
    statusBar: 'dark-content' as const,
  },
  dark: {
    background: '#02040A',
    surface: '#0D1117',
    surfaceHighlight: '#161B22',
    textPrimary: '#E2E8F0',
    textSecondary: '#94A3B8',
    primary: '#FF5F1F',
    primaryForeground: '#FFFFFF',
    secondary: '#22D3EE',
    accent: '#FBBF24',
    destructive: '#F87171',
    border: '#1E293B',
    success: '#34D399',
    inputBg: '#161B22',
    bubbleUser: '#FF5F1F',
    bubbleAi: '#0D1117',
    bubbleAiBorder: '#1E293B',
    actionCardBg: '#161B22',
    actionCardBorder: '#22D3EE',
    statusBar: 'light-content' as const,
  },
};

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = typeof Colors.light | typeof Colors.dark;

export function resolveTheme(mode: ThemeMode, systemScheme: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  if (mode === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return mode;
}

export function getColors(mode: ThemeMode, systemScheme: 'light' | 'dark' | null | undefined): ColorScheme {
  const resolved = resolveTheme(mode, systemScheme);
  return Colors[resolved];
}
