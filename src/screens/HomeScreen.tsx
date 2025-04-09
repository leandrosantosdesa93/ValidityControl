import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { useProductStore } from '../store/productStore';
import { RootTabScreenProps } from '../types/navigation';
import { eventEmitter, PRODUCT_EVENTS } from '../services/EventEmitter';

export default function HomeScreen({ navigation }: RootTabScreenProps<'Home'>) {
  const { products } = useProductStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Aqui você pode adicionar lógica adicional de carregamento se necessário
    } catch (error) {
      console.error('[Home] Erro ao carregar dados:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    console.log('[Home] Configurando listener de eventos...');
    const unsubscribe = eventEmitter.subscribe(PRODUCT_EVENTS.UPDATED, () => {
      console.log('[Home] Evento de atualização recebido');
      loadData();
    });

    return () => {
      console.log('[Home] Removendo listener de eventos');
      unsubscribe();
    };
  }, [loadData]);

  const expiringProducts = products.filter(product => {
    const expirationDate = new Date(product.expirationDate);
    const today = new Date();
    const diffDays = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 5;
  });

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={loadData}
          colors={['#00A1DF']}
        />
      }
    >
      <Text style={styles.title}>Produtos a Vencer</Text>
      {expiringProducts.length > 0 ? (
        expiringProducts.map(product => (
          <TouchableOpacity 
            key={product.code} 
            style={styles.productCard}
            onPress={() => {
              console.log('Produto selecionado:', product.code);
            }}
          >
            <Text style={styles.productCode}>{product.code}</Text>
            <Text style={styles.productDescription}>{product.description}</Text>
            <Text style={styles.productExpiration}>
              Vence em: {new Date(product.expirationDate).toLocaleDateString('pt-BR')}
            </Text>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.emptyText}>Nenhum produto próximo do vencimento</Text>
      )}
    </ScrollView>
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