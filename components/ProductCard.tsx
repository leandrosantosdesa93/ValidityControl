import React from 'react';
import { View, Pressable, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ThemedText } from '@components/ThemedText';
import { Product } from '@/types/Product';

interface ProductCardProps {
  product: Product;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  isDark: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onEditPress?: () => void;
  onDeletePress?: () => void;
  getExpirationInfo: (date: Date) => { 
    daysText: string;
    isExpired: boolean;
    color: string;
  };
}

export function ProductCard({
  product,
  isSelected = false,
  isSelectionMode = false,
  isDark,
  onPress,
  onLongPress,
  onEditPress,
  onDeletePress,
  getExpirationInfo
}: ProductCardProps) {
  const { daysText, isExpired, color } = getExpirationInfo(product.expirationDate);

  return (
    <Pressable
      style={[
        styles.productCard, 
        { 
          borderColor: isSelected ? '#2196F3' : 
                     isExpired ? '#FF4444' : 
                     color,
          backgroundColor: isDark ? '#222' : '#fff',
        }
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.productHeader}>
        <View style={styles.productImageContainer}>
          {product.photoUri ? (
            <Image source={{ uri: product.photoUri }} style={styles.productImage} />
          ) : (
            <View style={[styles.productImagePlaceholder, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
              <Ionicons name="cube-outline" size={24} color={isDark ? '#666' : '#999'} />
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <ThemedText style={[styles.productCode, { color: isDark ? '#888' : '#666' }]}>
            {product.code}
          </ThemedText>
          <ThemedText style={[styles.productDescription, { color: isDark ? '#fff' : '#000' }]}>
            {product.description}
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
            {onEditPress && (
              <Pressable
                style={[styles.actionButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                onPress={onEditPress}
              >
                <Ionicons name="create-outline" size={20} color="#2f95dc" />
              </Pressable>
            )}
            {onDeletePress && (
              <Pressable
                style={[styles.actionButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                onPress={onDeletePress}
              >
                <Ionicons name="trash-outline" size={20} color="#FF4444" />
              </Pressable>
            )}
          </View>
        )}
      </View>
      <View style={styles.productDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color={isDark ? '#888' : '#666'} />
          <ThemedText style={[styles.detailText, { color: isExpired ? '#FF4444' : isDark ? '#fff' : '#000' }]}>
            {daysText}
          </ThemedText>
        </View>
        <View style={styles.detailsFooter}>
          <View style={styles.detailRow}>
            <Ionicons name="cube" size={16} color={isDark ? '#888' : '#666'} />
            <ThemedText style={[styles.detailText, { color: isDark ? '#fff' : '#000' }]}>
              Quantidade: {product.quantity}
            </ThemedText>
          </View>
          <ThemedText style={[styles.dateText, { color: isDark ? '#888' : '#666' }]}>
            {format(product.expirationDate, "dd 'de' MMMM", { locale: ptBR })}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  checkbox: {
    padding: 4,
  },
  checkboxSelected: {
    opacity: 1,
  },
}); 