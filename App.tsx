import React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { paperTheme } from './src/constants/theme';
import { Slot } from 'expo-router';
import { useColorScheme } from '@hooks/useColorScheme';

export default function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <PaperProvider theme={paperTheme}>
        <Slot />
      </PaperProvider>
    </SafeAreaProvider>
  );
} 