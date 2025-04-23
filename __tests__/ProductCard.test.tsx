import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProductCard } from '../components/ProductCard';

// Mock para funções de expiração
const mockGetExpirationInfo = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const isExpired = date < today;
  
  return {
    daysText: isExpired ? 'Vencido' : 'Válido',
    isExpired,
    color: isExpired ? '#FF4444' : '#4CAF50',
    daysRemaining: 0
  };
};

describe('ProductCard', () => {
  const mockProduct = {
    id: '1',
    code: 'ABC123',
    description: 'Produto de teste',
    quantity: 10,
    expirationDate: new Date(),
    photoUri: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    isFavorite: false,
    isSold: false
  };
  
  const mockOnPress = jest.fn();
  const mockOnLongPress = jest.fn();
  const mockOnEditPress = jest.fn();
  const mockOnDeletePress = jest.fn();
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('renderiza corretamente com props básicas', () => {
    const { getByText } = render(
      <ProductCard
        product={mockProduct}
        isDark={false}
        onPress={mockOnPress}
        onLongPress={mockOnLongPress}
        getExpirationInfo={mockGetExpirationInfo}
      />
    );
    
    expect(getByText('ABC123')).toBeTruthy();
    expect(getByText('Produto de teste')).toBeTruthy();
    expect(getByText('Quantidade: 10')).toBeTruthy();
  });
  
  test('chama onPress quando o card é pressionado', () => {
    const { getByText } = render(
      <ProductCard
        product={mockProduct}
        isDark={false}
        onPress={mockOnPress}
        onLongPress={mockOnLongPress}
        getExpirationInfo={mockGetExpirationInfo}
      />
    );
    
    fireEvent.press(getByText('Produto de teste'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });
  
  test('chama onLongPress quando o card é pressionado longamente', () => {
    const { getByText } = render(
      <ProductCard
        product={mockProduct}
        isDark={false}
        onPress={mockOnPress}
        onLongPress={mockOnLongPress}
        getExpirationInfo={mockGetExpirationInfo}
      />
    );
    
    fireEvent(getByText('Produto de teste'), 'longPress');
    expect(mockOnLongPress).toHaveBeenCalledTimes(1);
  });
  
  test('renderiza botões de ação quando fornecidos', () => {
    const { getAllByRole } = render(
      <ProductCard
        product={mockProduct}
        isDark={false}
        onPress={mockOnPress}
        onLongPress={mockOnLongPress}
        onEditPress={mockOnEditPress}
        onDeletePress={mockOnDeletePress}
        getExpirationInfo={mockGetExpirationInfo}
      />
    );
    
    // Procura por elementos Pressable (botões)
    const pressables = getAllByRole('button');
    
    // Deve ter 3 pressables: o card principal e os dois botões de ação
    expect(pressables.length).toBe(3);
  });
  
  test('renderiza em modo de seleção quando isSelectionMode=true', () => {
    const { queryAllByRole } = render(
      <ProductCard
        product={mockProduct}
        isDark={false}
        isSelectionMode={true}
        isSelected={false}
        onPress={mockOnPress}
        onLongPress={mockOnLongPress}
        getExpirationInfo={mockGetExpirationInfo}
      />
    );
    
    // Não deve mostrar botões de edição/exclusão em modo de seleção
    const pressables = queryAllByRole('button');
    expect(pressables.length).toBe(1); // Apenas o card principal
  });
}); 