import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, FlatList, View, Image, Pressable, Alert, ActivityIndicator, RefreshControl, TouchableOpacity, Share } from 'react-native';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { Product } from '../src/types/Product';
import { format, differenceInDays, startOfDay, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getProducts, deleteProduct } from '../src/services/ProductService';
import { useColorScheme } from '../hooks/useColorScheme';
import { eventEmitter, PRODUCT_EVENTS } from '../src/services/EventEmitter';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { printToFileAsync } from 'expo-print';
import { NavigationService } from '../src/navigation/navigationService';

// Função que tenta fazer a navegação de maneira segura com fallback para o router do Expo
function safeNavigate(route: string | object, params?: any) {
  try {
    // Tenta usar o NavigationService primeiro
    if (NavigationService.isReady()) {
      console.log(`[Navigation] Navegando para ${typeof route === 'string' ? route : 'objeto'} via NavigationService`);
      
      // Se for um objeto (como um href do Expo Router), extraímos o caminho
      if (typeof route === 'object' && (route as any).pathname) {
        const routeObj = route as any;
        let navRoute = routeObj.pathname;
        
        // Conversão de rotas
        if (navRoute === '/register') {
          NavigationService.navigate('Add', routeObj.params || params);
        } else {
          NavigationService.navigate(navRoute as any, routeObj.params || params);
        }
      } else if (typeof route === 'string') {
        // Converte entre nomes de rotas se necessário
        let navRoute = route;
        if (route === '/register') navRoute = 'Add';
        
        NavigationService.navigate(navRoute as any, params);
      }
    } else {
      // Fallback para o router do Expo
      console.log(`[Navigation] Navegando para ${typeof route === 'string' ? route : 'objeto'} via Expo Router`);
      router.push(route as any);
    }
  } catch (error) {
    console.error('[Navigation] Erro ao navegar:', error);
    // Se falhar, tenta o router do Expo como última opção
    try {
      router.push(route as any);
    } catch (routerError) {
      console.error('[Navigation] Também falhou com router:', routerError);
    }
  }
}

export default function ExpiredScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isShareSelectionMode, setIsShareSelectionMode] = useState(false);

  useEffect(() => {
    loadProducts();
    const unsubscribe = eventEmitter.subscribe(PRODUCT_EVENTS.UPDATED, loadProducts);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, activeFilter]);

  function filterProducts() {
    const filtered = products.filter(product => {
      const daysExpired = getDaysExpired(product.expirationDate);
      switch (activeFilter) {
        case '15-30':
          return daysExpired >= 15;
        case '1-15':
          return daysExpired < 15;
        case 'all':
        default:
          return true;
      }
    });

    setFilteredProducts(filtered);
  }

  function getDaysExpired(expirationDate: Date) {
    const today = startOfDay(new Date());
    const expiration = startOfDay(new Date(expirationDate));
    const days = differenceInDays(today, expiration);
    return Math.abs(days); // Garante que o número seja positivo
  }

  async function loadProducts() {
    setIsLoading(true);
    try {
      const allProducts = await getProducts();
      const today = startOfDay(new Date());
      
      console.log('[ExpiredScreen] Data atual:', format(today, 'dd/MM/yyyy'));
      
      const expiredProducts = allProducts.filter(product => {
        const expirationDate = startOfDay(new Date(product.expirationDate));
        const isExpired = isBefore(expirationDate, today);
        
        console.log(
          '[ExpiredScreen] Produto:', 
          product.code,
          'Data vencimento:', 
          format(expirationDate, 'dd/MM/yyyy'),
          'Está vencido:', 
          isExpired
        );
        
        return isExpired;
      });
      
      const sorted = expiredProducts.sort((a, b) => {
        const dateA = startOfDay(new Date(a.expirationDate));
        const dateB = startOfDay(new Date(b.expirationDate));
        return dateA.getTime() - dateB.getTime(); // Do mais antigo para o mais recente
      });
      
      console.log('[ExpiredScreen] Total de produtos:', allProducts.length);
      console.log('[ExpiredScreen] Produtos vencidos encontrados:', expiredProducts.length);
      
      setProducts(sorted);
    } catch (error) {
      console.error('[ExpiredScreen] Erro ao carregar produtos:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function getExpirationInfo(date: Date) {
    const daysExpired = getDaysExpired(date);
    
    if (daysExpired > 30) {
      return {
        color: '#8B0000', // Dark Red
        icon: 'alert-circle-outline' as const,
        label: 'Crítico',
        textColor: '#FF4444'
      };
    }
    if (daysExpired > 15) {
      return {
        color: '#B22222', // Fire Brick
        icon: 'warning-outline' as const,
        label: 'Grave',
        textColor: '#FF6B6B'
      };
    }
    return {
      color: '#CD5C5C', // Indian Red
      icon: 'information-circle-outline' as const,
      label: 'Vencido',
      textColor: '#FF8888'
    };
  }

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
          setIsShareSelectionMode(false);
        }
      } else {
        newSelected.add(code);
      }
      setSelectedProducts(newSelected);
    }
  }

  function handleSelectAll() {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
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

  function handleShareSelected() {
    // Verificar se há produtos para compartilhar
    if (filteredProducts.length === 0) {
      return; // Se não houver produtos, não faz nada
    }
    
    if (isSelectionMode) {
      // No modo de seleção, compartilha apenas os produtos selecionados
      const selectedProductsArray = filteredProducts.filter(p => selectedProducts.has(p.code));
      if (selectedProductsArray.length > 0) {
        shareProducts(selectedProductsArray);
      }
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

  // Função para marcar um produto como vendido
  async function handleMarkProductAsSold(code: string) {
    try {
      Alert.alert(
        'Marcar como vendido',
        'Deseja realmente marcar este produto como vendido? Ele será removido da lista.',
        [
          {
            text: 'Cancelar',
            style: 'cancel'
          },
          {
            text: 'Confirmar',
            onPress: async () => {
              try {
                await deleteProduct(code);
                
                // Recarregar a lista de produtos
                loadProducts();
                Alert.alert('Sucesso', 'Produto marcado como vendido e removido com sucesso!');
              } catch (error) {
                console.error('Erro ao marcar produto como vendido:', error);
                Alert.alert('Erro', `Não foi possível marcar o produto como vendido: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Erro ao processar marcação de produto vendido:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao tentar marcar o produto como vendido.');
    }
  }

  function renderProduct({ item }: { item: Product }) {
    const { color, icon, label, textColor } = getExpirationInfo(item.expirationDate);
    const daysExpired = getDaysExpired(item.expirationDate);
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
            borderColor: isSelected ? '#2196F3' : color,
          }
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: color }]}>
            <Ionicons name={icon} size={14} color="#fff" style={styles.statusIcon} />
            <ThemedText style={styles.statusText}>{label}</ThemedText>
          </View>
          <ThemedText style={[styles.productCode, { color: isDark ? '#888' : '#666' }]}>
            {item.code}
          </ThemedText>
        </View>

        <View style={styles.cardContent}>
          {item.photoUri ? (
            <Image 
              source={{ uri: item.photoUri }} 
              style={styles.productImage}
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: isDark ? '#333' : '#f5f5f5' }]}>
              <Ionicons name="cube-outline" size={32} color={isDark ? '#666' : '#999'} />
            </View>
          )}

          <View style={styles.productInfo}>
            <ThemedText style={styles.productDescription} numberOfLines={2}>
              {item.description}
            </ThemedText>
            
            <View style={styles.expirationInfo}>
              <Ionicons name="alert-circle" size={16} color="#FF4444" />
              <ThemedText style={[styles.expirationText, { color: '#FF4444' }]}>
                Vencido há {daysExpired} dias
              </ThemedText>
            </View>

            <View style={styles.detailsRow}>
              <View style={styles.quantityContainer}>
                <Ionicons name="cube" size={16} color={isDark ? '#888' : '#666'} />
                <ThemedText style={styles.quantityText}>
                  {item.quantity} {item.quantity === 1 ? 'unidade' : 'unidades'}
                </ThemedText>
              </View>
              
              <ThemedText style={styles.dateText}>
                {format(item.expirationDate, "dd 'de' MMMM", { locale: ptBR })}
              </ThemedText>
            </View>
            
            {/* Botão de Marcar como Vendido */}
            <TouchableOpacity 
              style={styles.soldButton}
              onPress={() => handleMarkProductAsSold(item.code)}
            >
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <ThemedText style={styles.soldButtonText}>Marcar como Vendido</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
        {isSelectionMode && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            <Ionicons 
              name={isSelected ? "checkmark-circle" : "checkmark-circle-outline"} 
              size={24} 
              color={isSelected ? '#2196F3' : isDark ? '#666' : '#999'} 
            />
          </View>
        )}
      </Pressable>
    );
  }

  function renderHeader() {
    const filterOptions = [
      { 
        id: 'all',
        color: isDark ? '#fff' : '#666666',
        label: 'Todos',
        icon: 'list-outline' as const
      },
      { 
        id: '1-15',
        color: isDark ? '#FF8888' : '#CD5C5C',
        label: '1-15 dias',
        icon: 'information-circle-outline' as const
      },
      { 
        id: '15-30',
        color: isDark ? '#FF6B6B' : '#8B0000',
        label: '15-30 dias',
        icon: 'alert-circle-outline' as const
      }
    ];

    return (
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          {isSelectionMode ? (
            <View style={styles.selectionHeader}>
              <Pressable
                onPress={handleSelectAll}
                style={[styles.selectAllButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
              >
                <ThemedText style={[styles.selectAllText, { color: isDark ? '#fff' : '#000' }]}>
                  Todos
                </ThemedText>
                <Ionicons 
                  name={selectedProducts.size === filteredProducts.length ? "checkbox" : "square-outline"} 
                  size={20} 
                  color={selectedProducts.size === filteredProducts.length ? '#2196F3' : isDark ? '#fff' : '#000'} 
                />
                <ThemedText style={styles.selectionCount}>
                  {selectedProducts.size}/{filteredProducts.length}
                </ThemedText>
              </Pressable>
              <View style={styles.selectionActions}>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                  onPress={handleShareSelected}
                >
                  <Ionicons name="share-outline" size={24} color={isDark ? '#fff' : '#000'} />
                </Pressable>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
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
              <ThemedText style={styles.headerTitle}>
                Produtos Vencidos
              </ThemedText>
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
          <ThemedText style={styles.headerSubtitle}>
            Produtos com data de validade expirada
          </ThemedText>
        </View>
        
        <View style={[
          styles.legendContainer,
          { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }
        ]}>
          <View style={styles.legendRow}>
            {filterOptions.map((item) => (
              <Pressable 
                key={item.id}
                onPress={() => setActiveFilter(item.id)}
                style={[
                  styles.legendItem,
                  { 
                    backgroundColor: isDark ? '#333' : '#fff',
                    elevation: isDark ? 0 : 2,
                    flex: 1,
                    borderWidth: activeFilter === item.id ? 2 : 0,
                    borderColor: item.color,
                  }
                ]}
              >
                <View style={styles.legendContent}>
                  <View style={styles.legendIconContainer}>
                    <Ionicons name={item.icon} size={16} color={item.color} />
                    <ThemedText style={[
                      styles.legendText,
                      { 
                        color: isDark ? '#fff' : item.color,
                        fontWeight: '600'
                      }
                    ]}>
                      {item.label}
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
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
              background: linear-gradient(135deg, #d32f2f, #f44336);
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
              background: linear-gradient(135deg, #d32f2f, #f44336);
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
              grid-template-columns: repeat(3, 1fr);
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
              color: #d32f2f;
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
                background: #d32f2f !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .product-header {
                background: linear-gradient(135deg, #d32f2f, #f44336) !important;
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
            <h1>RELATÓRIO DE PRODUTOS VENCIDOS</h1>
            <div class="header-info">
              ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
            <div class="header-info">
              ${productsToShare.length} produto${productsToShare.length !== 1 ? 's' : ''}
            </div>
          </div>

          ${productsToShare.map(product => {
            const daysExpired = getDaysExpired(product.expirationDate);
            const statusText = `VENCIDO HÁ ${daysExpired} ${daysExpired === 1 ? 'DIA' : 'DIAS'}`;
            
            return `
              <div class="product">
                <div class="product-header">
                  <div class="product-header-content">
                    <div style="display: flex; align-items: center;">
                      <span class="code">${product.code}</span>
                      <span class="quantity-badge">${product.quantity} UN</span>
                    </div>
                    <span class="status-badge">
                      ${statusText}
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
            `;
          }).join('')}

          <div class="footer">
            Documento gerado por ValidityControl
          </div>
        </body>
      </html>
    `;
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={item => item.code}
        contentContainerStyle={styles.list}
        onRefresh={loadProducts}
        refreshing={isLoading}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons 
              name="checkmark-circle-outline"
              size={64}
              color={isDark ? '#333' : '#ccc'}
            />
            <ThemedText style={styles.emptyTitle}>
              Nenhum Produto Vencido!
            </ThemedText>
            <ThemedText style={styles.emptyText}>
              {activeFilter === '15-30'
                ? 'Nenhum produto vencido entre 15 e 30 dias'
                : activeFilter === '1-15'
                ? 'Nenhum produto vencido nos últimos 15 dias'
                : 'Nenhum produto vencido encontrado'}
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  legendContainer: {
    marginTop: 4,
    padding: 4,
    borderRadius: 8,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 4,
  },
  legendItem: {
    alignItems: 'center',
    padding: 4,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  legendContent: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 2,
  },
  legendIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  list: {
    flexGrow: 1,
  },
  productCard: {
    margin: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  productCode: {
    fontSize: 12,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 0,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    opacity: 0.7,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productDescription: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  expirationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  expirationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quantityText: {
    fontSize: 14,
  },
  dateText: {
    fontSize: 12,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
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
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  checkboxSelected: {
    opacity: 1,
  },
  soldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    gap: 6
  },
  soldButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  },
}); 