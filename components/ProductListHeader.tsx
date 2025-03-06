import React from 'react';
import { View, Pressable, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@components/ThemedText';

interface ProductListHeaderProps {
  title: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleShareSelected: () => void;
  filteredProductsCount: number;
  isDark: boolean;
}

export function ProductListHeader({
  title,
  searchQuery,
  setSearchQuery,
  handleShareSelected,
  filteredProductsCount,
  isDark
}: ProductListHeaderProps) {
  return (
    <View style={[styles.container, { borderBottomColor: isDark ? '#333' : '#e0e0e0' }]}>
      <View style={styles.headerTop}>
        <ThemedText style={styles.headerTitle}>
          {title}
        </ThemedText>
        {filteredProductsCount > 0 && (
          <Pressable
            style={[styles.shareButton, { backgroundColor: isDark ? '#333' : '#f5f5f5' }]}
            onPress={handleShareSelected}
          >
            <Ionicons name="share-outline" size={24} color={isDark ? '#fff' : '#000'} />
          </Pressable>
        )}
      </View>
      <View style={[
        styles.searchInputContainer,
        {
          backgroundColor: isDark ? '#333' : '#f5f5f5',
        }
      ]}>
        <Ionicons name="search" size={20} color={isDark ? '#888' : '#666'} />
        <TextInput
          style={[styles.searchInput, { color: isDark ? '#fff' : '#000' }]}
          placeholder="Buscar por código, desc, data"
          placeholderTextColor={isDark ? '#888' : '#999'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          blurOnSubmit={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={isDark ? '#888' : '#666'} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    height: 40,
    paddingVertical: 8,
  },
}); 