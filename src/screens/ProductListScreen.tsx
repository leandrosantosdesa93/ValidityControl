import React from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { ProductCard } from '../components/Product/ProductCard';
import { useProducts } from '../hooks/useProducts';
import { Product } from '../types/Product';

export const ProductListScreen: React.FC = () => {
  const { products, loading, error } = useProducts();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList<Product>
        data={products}
        renderItem={({ item }: { item: Product }) => <ProductCard product={item} />}
        keyExtractor={(item: Product) => item.code}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
});