import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';

interface EmptyProductListProps {
  message: string;
  icon?: string;
  isDark: boolean;
}

export function EmptyProductList({ message, icon = 'cube-outline', isDark }: EmptyProductListProps) {
  return (
    <View style={styles.container}>
      <Ionicons 
        name={icon} 
        size={64} 
        color={isDark ? '#444' : '#ccc'} 
        style={styles.icon} 
      />
      <ThemedText 
        style={[
          styles.message, 
          { color: isDark ? '#888' : '#666' }
        ]}
      >
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  icon: {
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: '80%',
  },
}); 