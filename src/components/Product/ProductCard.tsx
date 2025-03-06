import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Product } from '../../types/Product';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.code}>{product.code}</Text>
      <Text style={styles.description}>{product.description}</Text>
      <Text style={styles.quantity}>Quantidade: {product.quantity}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 8,
    elevation: 2,
  },
  code: {
    fontSize: 14,
    color: '#666',
  },
  description: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  quantity: {
    fontSize: 14,
    color: '#444',
    marginTop: 4,
  },
}); 