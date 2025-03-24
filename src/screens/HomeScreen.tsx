import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useProductStore } from '../store/productStore';

export default function HomeScreen() {
  const { products } = useProductStore();
  const expiringProducts = products.filter(product => {
    const expirationDate = new Date(product.expirationDate);
    const today = new Date();
    const diffDays = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 5;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Produtos a Vencer</Text>
      {expiringProducts.length > 0 ? (
        expiringProducts.map(product => (
          <View key={product.code} style={styles.productCard}>
            <Text style={styles.productCode}>{product.code}</Text>
            <Text style={styles.productDescription}>{product.description}</Text>
            <Text style={styles.productExpiration}>
              Vence em: {new Date(product.expirationDate).toLocaleDateString('pt-BR')}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Nenhum produto próximo do vencimento</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  productCard: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  productCode: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  productExpiration: {
    fontSize: 14,
    color: '#ff6b6b',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
}); 