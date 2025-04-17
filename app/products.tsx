import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, FlatList, TextInput, View, Image, Pressable, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { Product } from '../src/types/Product';
import { format, startOfDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getProducts, deleteProduct } from '../src/services/ProductService';
import { useColorScheme } from '../hooks/useColorScheme';
import { eventEmitter, PRODUCT_EVENTS } from '../src/services/EventEmitter';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { printToFileAsync } from 'expo-print';
import { NavigationService } from '../src/navigation/navigationService';

export default function ProductListScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isShareSelectionMode, setIsShareSelectionMode] = useState(false);

  // Utility functions
  const sortProductsByExpiration = useCallback((productsToSort: Product[]) => {
    return [...productsToSort].sort((a, b) => {
      const dateA = new Date(a.expirationDate);
      const dateB = new Date(b.expirationDate);
      return dateB.getTime() - dateA.getTime();
    });
  }, []);

  const filterAndSortProducts = useCallback(() => {
    let filtered = products;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = products.filter(product => {
        // Busca por código ou descrição
        const matchesCodeOrDescription = 
          product.code.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query);

        // Busca por data de vencimento
        const expirationDate = format(new Date(product.expirationDate), "dd/MM/yyyy", { locale: ptBR }).toLowerCase();
        const matchesDate = expirationDate.includes(query);

        // Busca por status de vencimento
        const daysToExpiry = differenceInDays(new Date(product.expirationDate), startOfDay(new Date()));
        const matchesExpirationStatus = 
          (query === 'vencido' && daysToExpiry < 0) ||
          (query === 'hoje' && daysToExpiry === 0) ||
          (query === 'amanhã' && daysToExpiry === 1) ||
          (query === 'vence' && daysToExpiry >= 0);

        return matchesCodeOrDescription || matchesDate || matchesExpirationStatus;
      });
    }

    // Ordena os produtos por data de vencimento
    const sorted = sortProductsByExpiration(filtered);
    setFilteredProducts(sorted);
  }, [products, searchQuery, sortProductsByExpiration]);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getProducts();
      // Ordena os produtos assim que são carregados
      const sortedData = sortProductsByExpiration(data);
      setProducts(sortedData);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sortProductsByExpiration]);

  useEffect(() => {
    loadProducts();
    const unsubscribe = eventEmitter.subscribe(PRODUCT_EVENTS.UPDATED, loadProducts);
    return () => unsubscribe();
  }, [loadProducts]);

  useEffect(() => {
    filterAndSortProducts();
  }, [filterAndSortProducts]);

  const handleEditProduct = useCallback(async (product: Product) => {
    console.log('[ProductsScreen] Editando produto:', product.code);
    
    // Usar timestamp para forçar recarregamento
    const timestamp = new Date().getTime();
    console.log('[ProductsScreen] Timestamp para navegação:', timestamp);
    
    const navigationParams = {
      productId: product.code,
      timestamp: timestamp.toString()
    };
    
    try {
      if (NavigationService.isReady()) {
        NavigationService.navigate('Add', navigationParams);
      } else {
        router.push({
          pathname: '/register',
          params: navigationParams
        });
      }
    } catch (error) {
      console.error('[Navigation] Erro ao navegar:', error);
      router.push({
        pathname: '/register',
        params: navigationParams
      });
    }
  }, []);

  function handleLongPress(code: string) {
    setIsSelectionMode(true);
    setIsShareSelectionMode(false);
    setSelectedProducts(new Set([code]));
  }

  function handleProductPress(code: string) {
    if (isSelectionMode) {
      const newSelected = new Set(selectedProducts);
      if (newSelected.has(code)) {
        newSelected.delete(code);
        if (newSelected.size === 0) {
          setIsSelectionMode(false);
        }
      } else {
        newSelected.add(code);
      }
      setSelectedProducts(newSelected);
    }
  }

  async function handleDeleteProduct(product: Product) {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja realmente excluir o produto "${product.description}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product.code);
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir o produto');
            }
          }
        }
      ]
    );
  }

  async function handleDeleteSelected() {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja realmente excluir ${selectedProducts.size} produtos?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const code of selectedProducts) {
                await deleteProduct(code);
              }
              setIsSelectionMode(false);
              setSelectedProducts(new Set());
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir os produtos');
            }
          }
        }
      ]
    );
  }

  function handleShareSelected() {
    if (isSelectionMode) {
      // No modo de seleção, compartilha apenas os produtos selecionados
      shareProducts(filteredProducts.filter(p => selectedProducts.has(p.code)));
      setSelectedProducts(new Set());
      setIsSelectionMode(false);
      setIsShareSelectionMode(false);
    } else {
      // No modo normal, ativa o modo de seleção e seleciona todos os produtos
      setIsSelectionMode(true);
      setIsShareSelectionMode(true);
      setSelectedProducts(new Set(filteredProducts.map(p => p.code)));
    }
  }

  async function shareProducts(productsToShare: Product[]) {
    try {
      const html = generateHTML(productsToShare);
      
      const { uri } = await printToFileAsync({
        html: html,
        base64: false
      });

      await Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf'
      });
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      Alert.alert('Erro', 'Erro ao gerar o PDF para compartilhamento');
    }
  }

  function generateHTML(productsToShare: Product[]) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: Arial, sans-serif;
              margin: 15px;
              color: #1a1a1a;
              line-height: 1.4;
              background-color: #ffffff;
            }
            .header { 
              text-align: center;
              margin-bottom: 15px;
              padding: 15px;
              background: linear-gradient(135deg, #1976D2, #2196F3);
              border-radius: 10px;
              color: white;
            }
            .header h1 {
              margin: 0 0 10px 0;
              font-size: 30px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: white;
            }
            .header-info {
              display: inline-block;
              padding: 6px 12px;
              background: rgba(255,255,255,0.2);
              border-radius: 6px;
              margin: 4px;
              font-size: 20px;
            }
            .product { 
              background: white;
              margin: 10px 0;
              border-radius: 10px;
              border: 1px solid #e0e0e0;
              page-break-inside: avoid;
            }
            .product-header {
              background: linear-gradient(135deg, #1976D2, #2196F3);
              padding: 10px;
              color: white;
              border-radius: 10px 10px 0 0;
            }
            .product-header-content {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            }
            .code {
              background: rgba(255,255,255,0.2);
              padding: 6px 12px;
              border-radius: 15px;
              font-family: monospace;
              font-size: 25px;
              font-weight: 600;
            }
            .quantity-badge {
              background: rgba(255,255,255,0.2);
              padding: 6px 12px;
              border-radius: 15px;
              font-size: 22px;
              font-weight: 600;
              margin-left: 10px;
            }
            .status-badge {
              background: rgba(255,255,255,0.2);
              padding: 6px 12px;
              border-radius: 15px;
              font-size: 25px;
              font-weight: 600;
            }
            .status-badge.expired {
              background: rgba(244,67,54,0.8);
            }
            .status-badge.expiring {
              background: rgba(255,152,0,0.8);
            }
            .status-badge.ok {
              background: rgba(76,175,80,0.8);
            }
            .description {
              font-size: 30px;
              font-weight: 600;
              margin: 0;
              line-height: 1.4;
            }
            .product-content {
              padding: 20px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin-top: 8px;
            }
            .info-item {
              background: #f0f0f0;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .info-label {
              font-size: 20px;
              color: #333;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
              font-weight: 600;
            }
            .info-value {
              font-size: 18px;
              color: #000000;
              font-weight: 600;
              line-height: 1.4;
            }
            .info-value.expiration {
              color: #000000;
              font-size: 18px;
              font-weight: 700;
            }
            .footer {
              text-align: center;
              padding: 15px;
              margin-top: 30px;
              color: #666;
              font-size: 12px;
              border-top: 1px solid #e0e0e0;
            }
            @media print {
              body { 
                margin: 15px;
                background: white;
              }
              .product {
                margin: 15px 0;
                border: 1px solid #e0e0e0;
                box-shadow: none;
              }
              .header {
                background: #1976D2 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .product-header {
                background: linear-gradient(135deg, #1976D2, #2196F3);
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .info-item {
                background: #f0f0f0 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>RELATÓRIO DE PRODUTOS</h1>
            <div class="header-info">
              ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
            <div class="header-info">
              ${productsToShare.length} produto${productsToShare.length !== 1 ? <ThemedText>s</ThemedText> : ''}
            </div>
          </div>

          ${productsToShare.map(product => `
            <div class="product">
              <div class="product-header">
                <div class="product-header-content">
                  <div style="display: flex; align-items: center;">
                    <span class="code">${product.code}</span>
                    <span class="quantity-badge">${product.quantity} UN</span>
                  </div>
                  <span class="status-badge ${getStatusClass(product)}">
                    ${getStatusText(product)}
                  </span>
                </div>
                <div class="description">${product.description}</div>
              </div>

              <div class="product-content">
                <div class="info-grid">
                  <div class="info-item">
                    <div class="info-label">Cadastro</div>
                    <div class="info-value">
                      ${format(new Date(product.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>

                  ${product.updatedAt ? `
                    <div class="info-item">
                      <div class="info-label">Atualização</div>
                      <div class="info-value">
                        ${format(new Date(product.updatedAt), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  ` : ''}

                  <div class="info-item">
                    <div class="info-label">Vencimento</div>
                    <div class="info-value expiration">
                      ${format(new Date(product.expirationDate), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}

          <div class="footer">
            Documento gerado por ValidityControl
          </div>
        </body>
      </html>
    `;
  }

  function getStatusClass(product: Product): string {
    const today = startOfDay(new Date());
    const expirationDate = startOfDay(new Date(product.expirationDate));
    const daysToExpiry = differenceInDays(expirationDate, today);

    if (daysToExpiry < 0) return 'expired';
    if (daysToExpiry <= 5) return 'expiring';
    return 'ok';
  }

  function getStatusText(product: Product): string {
    const today = startOfDay(new Date());
    const expirationDate = startOfDay(new Date(product.expirationDate));
    const daysToExpiry = differenceInDays(expirationDate, today);

    if (daysToExpiry < 0) return 'VENCIDO';
    if (daysToExpiry === 0) return 'VENCE HOJE';
    if (daysToExpiry === 1) return 'VENCE AMANHÃ';
    if (daysToExpiry <= 5) return `VENCE EM ${daysToExpiry} DIAS`;
    return 'REGULAR';
  }

  function handleSelectAll() {
    if (selectedProducts.size === filteredProducts.length) {
      // Se todos já estão selecionados, desmarca todos
      setSelectedProducts(new Set());
    } else {
      // Seleciona todos os produtos filtrados
      setSelectedProducts(new Set(filteredProducts.map(p => p.code)));
    }
  }

  function renderHeader() {
    return (
      <View style={[styles.searchContainer, { borderBottomColor: isDark ? '#333' : '#e0e0e0'}]}>
        {isSelectionMode ? (
          <View style={styles.selectionHeader}>
            <Pressable
              onPress={handleSelectAll}
              style={[styles.selectAllButton, { backgroundColor: isDark ? '#333' : '#f0f0f0'}]}
            >
              <ThemedText style={[styles.selectAllText, { color: isDark ? '#fff' : '#000'}]}>
                Todos
              </ThemedText>
              <Ionicons 
                name={selectedProducts.size === filteredProducts.length ? 'checkbox' : "square-outline"} 
                size={20} 
                color={selectedProducts.size === filteredProducts.length ? '#2196F3' : isDark ? '#fff' : '#000'} 
              />
              <ThemedText style={styles.selectionCount}>
                {selectedProducts.size}/{filteredProducts.length}
              </ThemedText>
            </Pressable>
            <View style={styles.selectionActions}>
              <Pressable
                style={[styles.actionButton, { backgroundColor: isDark ? '#333' : '#f0f0f0'}]}
                onPress={handleShareSelected}
              >
                <Ionicons name="share-outline" size={24} color={isDark ? '#fff' : '#000'} />
              </Pressable>
              {!isShareSelectionMode && (
                <Pressable
                  style={[styles.actionButton, { backgroundColor: isDark ? '#333' : '#f0f0f0'}]}
                  onPress={handleDeleteSelected}
                >
                  <Ionicons name="trash-outline" size={24} color="#FF4444" />
                </Pressable>
              )}
              <Pressable
                style={[styles.actionButton, { backgroundColor: isDark ? '#333' : '#f0f0f0'}]}
                onPress={() => {
                  setIsSelectionMode(false);
                  setSelectedProducts(new Set());
                  setIsShareSelectionMode(false);
                }}
              >
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.headerTop}>
            <View style={[
              styles.searchInputContainer,
              {
                backgroundColor: isDark ? '#333' : '#f5f5f5',
                flex: 1,
              }
            ]}>
              <Ionicons name="search" size={20} color={isDark ? '#888' : '#666'} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? '#fff' : '#000'}]}
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
            {filteredProducts.length > 0 && (
              <Pressable
                style={[styles.shareButton, { backgroundColor: isDark ? '#333' : '#f5f5f5' }]}
                onPress={handleShareSelected}
              >
                <Ionicons name="share-outline" size={24} color={isDark ? '#fff' : '#000'} />
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  }

  function renderProduct({ item }: { item: Product }) {
    const today = startOfDay(new Date());
    const expirationDate = startOfDay(new Date(item.expirationDate));
    const daysToExpiry = differenceInDays(expirationDate, today);
    const isExpired = daysToExpiry < 0;
    const isSelected = selectedProducts.has(item.code);
    
    return (
      <Pressable
        onPress={() => handleProductPress(item.code)}
        onLongPress={() => handleLongPress(item.code)}
        delayLongPress={500}
        style={[
          styles.productCard,
          {
            backgroundColor: isDark ? '#1a1a1a' : '#fff',
            borderColor: isSelected ? '#2196F3' : isExpired ? '#FF4444' : 
                        daysToExpiry <= 5 ? '#FFD700' : 
                        daysToExpiry >= 6 ? '#4CAF50' : 
                        isDark ? '#333' : '#e0e0e0',
            elevation: isDark ? 0 : 2,
          }
        ]}
      >
        <View style={styles.productHeader}>
          <View style={styles.productImageContainer}>
            {item.photoUri ? (
              <Image source={{ uri: item.photoUri }} style={styles.productImage} />
            ) : (
              <View style={[styles.productImagePlaceholder, { backgroundColor: isDark ? '#333' : '#f0f0f0'}]}>
                <Ionicons name="cube-outline" size={24} color={isDark ? '#666' : '#999'} />
              </View>
            )}
          </View>
          <View style={styles.productInfo}>
            <ThemedText style={[styles.productCode, { color: isDark ? '#888' : '#666'}]}>
              {item.code}
            </ThemedText>
            <ThemedText style={[styles.productDescription, { color: isDark ? '#fff' : '#000'}]}>
              {item.description}
            </ThemedText>
          </View>
          {isSelectionMode ? (
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              <Ionicons 
                name={isSelected ? 'checkmark-circle' : "checkmark-circle-outline"} 
                size={24} 
                color={isSelected ? '#2196F3' : isDark ? '#666' : '#999'} 
              />
            </View>
          ) : (
            <View style={styles.actionButtons}>
              <Pressable
                style={[styles.actionButton, { backgroundColor: isDark ? '#333' : '#f0f0f0'}]}
                onPress={() => handleEditProduct(item)}
              >
                <Ionicons name="create-outline" size={20} color="#2f95dc" />
              </Pressable>
              <Pressable
                style={[styles.actionButton, { backgroundColor: isDark ? '#333' : '#f0f0f0'}]}
                onPress={() => handleDeleteProduct(item)}
              >
                <Ionicons name="trash-outline" size={20} color="#FF4444" />
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.productDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color={isDark ? '#888' : '#666'} />
            <ThemedText style={[styles.detailText, { color: isExpired ? '#FF4444' : isDark ? '#fff' : '#000'}]}>
              {isExpired ? 'Vencido' : daysToExpiry === 0 ? 'Vence hoje' :
               daysToExpiry === 1 ? 'Vence amanhã' : `Vence em ${daysToExpiry} dias`}
            </ThemedText>
          </View>
          <View style={styles.detailsFooter}>
            <View style={styles.detailRow}>
              <Ionicons name="cube" size={16} color={isDark ? '#888' : '#666'} />
              <ThemedText style={[styles.detailText, { color: isDark ? '#fff' : '#000'}]}>
                Quantidade: {item.quantity}
              </ThemedText>
            </View>
            <ThemedText style={[styles.dateText, { color: isDark ? '#888' : '#666'}]}>
              {format(item.expirationDate, "dd 'de' MMMM", { locale: ptBR })}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerContainer}>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.searchWrapper}>
          {renderHeader()}
        </ScrollView>
      </View>
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={item => item.code}
        contentContainerStyle={[
          styles.list,
          filteredProducts.length === 0 && styles.emptyListContainer
        ]}
        onRefresh={loadProducts}
        refreshing={isLoading}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={true}
        removeClippedSubviews={true}
        initialNumToRender={10}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={searchQuery ? 'search' : "cube"}
              size={48}
              color={isDark ? '#333' : '#ccc'}
            />
            <ThemedText style={[styles.emptyText, { color: isDark ? '#888' : '#666'}]}>
              {searchQuery
                ? 'Nenhum produto encontrado'
                : 'Nenhum produto cadastrado'}
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexShrink: 0,
    zIndex: 1,
  },
  searchWrapper: {
    borderBottomWidth: 1,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
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
  list: {
    padding: 16,
    flexGrow: 1,
  },
  productCard: {
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  productHeader: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  productImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#f5f5f5',
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productCode: {
    fontSize: 14,
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 18,
    fontWeight: '600',
  },
  productDetails: {
    padding: 12,
    paddingTop: 0,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  detailsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    opacity: 0.7,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  checkbox: {
    padding: 4,
  },
  checkboxSelected: {
    opacity: 1,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
  },
}); 

