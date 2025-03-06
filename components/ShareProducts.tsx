import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '@/types/Product';
import * as Sharing from 'expo-sharing';
import { printToFileAsync } from 'expo-print';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useColorScheme } from '@hooks/useColorScheme';

interface ShareProductsProps {
  isVisible: boolean;
  onClose: () => void;
  products: Product[];
  screenName: string;
}

export function ShareProducts({ isVisible, onClose, products, screenName }: ShareProductsProps) {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getStatusClass = (product: Product): string => {
    const today = startOfDay(new Date());
    const expirationDate = startOfDay(new Date(product.expirationDate));
    const daysToExpiry = differenceInDays(expirationDate, today);

    if (daysToExpiry < 0) return 'expired';
    if (daysToExpiry <= 5) return 'expiring';
    return 'ok';
  };

  const getStatusText = (product: Product): string => {
    const today = startOfDay(new Date());
    const expirationDate = startOfDay(new Date(product.expirationDate));
    const daysToExpiry = differenceInDays(expirationDate, today);

    if (daysToExpiry < 0) return 'VENCIDO';
    if (daysToExpiry === 0) return 'VENCE HOJE';
    if (daysToExpiry === 1) return 'VENCE AMANHÃ';
    if (daysToExpiry <= 5) return `VENCE EM ${daysToExpiry} DIAS`;
    return 'REGULAR';
  };

  const getDaysInfo = (product: Product): string => {
    const today = startOfDay(new Date());
    const expirationDate = startOfDay(new Date(product.expirationDate));
    const daysToExpiry = differenceInDays(expirationDate, today);

    if (daysToExpiry < 0) return `Vencido há ${Math.abs(daysToExpiry)} dias`;
    if (daysToExpiry === 0) return 'Vence hoje';
    if (daysToExpiry === 1) return 'Vence amanhã';
    return `Vence em ${daysToExpiry} dias`;
  };

  const toggleProduct = (code: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(code)) {
      newSelected.delete(code);
    } else {
      newSelected.add(code);
    }
    setSelectedProducts(newSelected);
  };

  const toggleAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.code)));
    }
  };

  const generateHTML = () => {
    const selectedProductsList = products.filter(p => selectedProducts.has(p.code));
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <script>
            function getDaysUntilExpiration(expirationDate) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const expiration = new Date(expirationDate);
              expiration.setHours(0, 0, 0, 0);
              return Math.floor((expiration - today) / (1000 * 60 * 60 * 24));
            }
          </script>
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
              background: ${screenName === 'Produtos' ? 
                'linear-gradient(135deg, #1976D2, #2196F3)' : 
                screenName === 'Vencidos' ? 
                'linear-gradient(135deg, #d32f2f, #f44336)' : 
                'linear-gradient(135deg, #ed6c02, #ff9800)'};
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
              color: ${screenName === 'Vencidos' ? '#d32f2f' : 
                      screenName === 'A Vencer' ? '#ed6c02' : '#000000'};
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
            .days-info {
              font-size: 14px;
              color: #666;
              margin-top: 4px;
            }
            .days-info.expired {
              color: #d32f2f;
            }
            .days-info.expiring {
              color: #ed6c02;
            }
            .days-info.ok {
              color: #4caf50;
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
                background: ${screenName === 'Produtos' ? 
                  'linear-gradient(135deg, #1976D2, #2196F3)' : 
                  screenName === 'Vencidos' ? 
                  'linear-gradient(135deg, #d32f2f, #f44336)' : 
                  'linear-gradient(135deg, #ed6c02, #ff9800)'};
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .detail-item {
                background: #f5f5f5 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .info-item {
                background: #f0f0f0 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .info-value {
                color: #000000 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .info-label {
                color: #333333 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>RELATÓRIO DE PRODUTOS - ${screenName.toUpperCase()}</h1>
            <div class="header-info">
              ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
            <div class="header-info">
              ${selectedProductsList.length} produto${selectedProductsList.length !== 1 ? 's' : ''}
            </div>
          </div>

          ${selectedProductsList.map(product => `
            <div class="product">
              <div class="product-header">
                <div class="product-header-content">
                  <div style="display: flex; align-items: center;">
                    <span class="code">${product.code}</span>
                    <span class="quantity-badge">${product.quantity} UN</span>
                  </div>
                  <span class="status-badge ${screenName === 'Produtos' ? getStatusClass(product) : screenName === 'A Vencer' ? 'expiring' : ''}">
                    ${screenName === 'Produtos' ? getStatusText(product) : 
                      screenName === 'Vencidos' ? 'VENCIDO' : 
                      differenceInDays(new Date(product.expirationDate), new Date()) === 0 ? 'VENCE HOJE' :
                      differenceInDays(new Date(product.expirationDate), new Date()) === 1 ? 'VENCE AMANHÃ' :
                      `VENCE EM ${differenceInDays(new Date(product.expirationDate), new Date())} DIAS`}
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
  };

  const handleShare = async () => {
    try {
      if (selectedProducts.size === 0) {
        alert('Selecione pelo menos um produto para compartilhar');
        return;
      }

      const html = generateHTML();
      
      const { uri } = await printToFileAsync({
        html: html,
        base64: false
      });

      await Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf'
      });

      onClose();
      setSelectedProducts(new Set());
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      alert('Erro ao gerar o PDF para compartilhamento');
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <ThemedView style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Compartilhar Produtos</ThemedText>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
            </Pressable>
          </View>

          <Pressable
            style={[styles.selectAllButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
            onPress={toggleAll}
          >
            <ThemedText>
              {selectedProducts.size === products.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </ThemedText>
            <ThemedText style={styles.selectedCount}>
              ({selectedProducts.size}/{products.length})
            </ThemedText>
          </Pressable>

          <ScrollView style={styles.productList}>
            {products.map(product => (
              <Pressable
                key={product.code}
                style={[
                  styles.productItem,
                  {
                    backgroundColor: selectedProducts.has(product.code)
                      ? isDark ? '#2196F3' : '#E3F2FD'
                      : isDark ? '#333' : '#f5f5f5'
                  }
                ]}
                onPress={() => toggleProduct(product.code)}
              >
                <View style={styles.productInfo}>
                  <ThemedText style={styles.productCode}>{product.code}</ThemedText>
                  <ThemedText style={styles.productDescription} numberOfLines={2}>
                    {product.description}
                  </ThemedText>
                  <ThemedText style={styles.productExpiration}>
                    {format(new Date(product.expirationDate), "dd 'de' MMMM", { locale: ptBR })}
                  </ThemedText>
                </View>
                <Ionicons
                  name={selectedProducts.has(product.code) ? "checkmark-circle" : "checkmark-circle-outline"}
                  size={24}
                  color={selectedProducts.has(product.code) ? '#4CAF50' : isDark ? '#666' : '#999'}
                />
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            style={[
              styles.shareButton,
              {
                backgroundColor: selectedProducts.size > 0 ? '#4CAF50' : isDark ? '#333' : '#e0e0e0'
              }
            ]}
            onPress={handleShare}
            disabled={selectedProducts.size === 0}
          >
            <Ionicons name="share-outline" size={24} color="#fff" />
            <ThemedText style={styles.shareButtonText}>
              Compartilhar ({selectedProducts.size})
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  selectAllButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedCount: {
    opacity: 0.7,
  },
  productList: {
    marginBottom: 16,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productCode: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  productExpiration: {
    fontSize: 12,
    opacity: 0.7,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 