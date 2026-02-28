import React, { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { ThemeProvider, useTheme } from '../src/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_completed').then((val) => {
      if (val !== 'true') {
        setCheckedOnboarding(true);
      }
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (checkedOnboarding) {
      setCheckedOnboarding(false);
      router.replace('/onboarding');
    }
  }, [isReady, checkedOnboarding]);

  if (!isReady) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

function InnerLayout() {
  const { colors, resolved } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <NavigationGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="memory" />
          <Stack.Screen name="tools" />
          <Stack.Screen name="models" />
          <Stack.Screen name="soul-editor" />
          <Stack.Screen name="keywords" />
          <Stack.Screen name="benchmark" />
        </Stack>
      </NavigationGuard>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
