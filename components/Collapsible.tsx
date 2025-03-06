import React, { useState } from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';

interface CollapsibleProps {
  title: string;
  children: React.ReactNode;
}

export function Collapsible({ title, children }: CollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setIsExpanded(!isExpanded)} style={styles.header}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">{title}</ThemedText>
          <IconSymbol
            name={isExpanded ? "chevron.up" : "chevron.down"}
            size={20}
            color="#000"
            style={styles.icon}
          />
        </ThemedView>
      </Pressable>
      {isExpanded && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    paddingVertical: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: {
    marginLeft: 8,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 16,
  },
});
