import { DefaultTheme as PaperDefaultTheme } from 'react-native-paper';
import { DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';

export const COLORS = {
  primary: '#007AFF',
  background: '#F8F9FA',
  card: '#FFFFFF',
  text: '#000000',
  border: '#E9ECEF',
  notification: '#FF3B30',
  warning: {
    five: '#FFD700',   // 5 dias - Amarelo
    three: '#FFA500',  // 3 dias - Laranja
    one: '#FF0000'     // 1 dia - Vermelho
  }
} as const;

// Tema para o React Native Paper
export const paperTheme = {
  ...PaperDefaultTheme,
  colors: {
    ...PaperDefaultTheme.colors,
    primary: '#007AFF',
    accent: '#0055FF',
  },
};

// Tema para o React Navigation
export const navigationTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: paperTheme.colors.primary,
  },
}; 