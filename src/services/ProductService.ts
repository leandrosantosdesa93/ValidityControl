import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/Product';
import { eventEmitter, PRODUCT_EVENTS } from '@/services/EventEmitter';
import { cancelProductNotifications } from '@/services/notifications';

const STORAGE_KEY = '@ValidityControl:products';

type ProductFormData = {
  description: string;
  expirationDate: Date;
  quantity: number;
  photoUri?: string;
  code?: string;
};

function generateProductCode(): string {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PROD-${random}`;
}

export async function saveProduct(formData: ProductFormData): Promise<Product> {
  console.log('[ProductService] Iniciando salvamento do produto');
  console.log('[ProductService] Dados recebidos:', JSON.stringify(formData, null, 2));
  
  try {
    console.log('[ProductService] Buscando produtos existentes');
    const products = await getProducts();
    console.log('[ProductService] Produtos atuais:', products.length);
    
    console.log('[ProductService] Gerando código para o novo produto');
    const newProduct: Product = {
      ...formData,
      code: formData.code ? (formData.code.startsWith('PROD-') ? formData.code : `PROD-${formData.code}`) : generateProductCode(),
      createdAt: new Date(),
      isFavorite: false,
    };
    
    console.log('[ProductService] Novo produto criado:', JSON.stringify(newProduct, null, 2));
    
    products.push(newProduct);
    console.log('[ProductService] Produto adicionado à lista. Total:', products.length);
    
    console.log('[ProductService] Salvando no AsyncStorage');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    console.log('[ProductService] Dados salvos com sucesso no AsyncStorage');
    
    console.log('[ProductService] Emitindo evento de atualização');
    eventEmitter.emit(PRODUCT_EVENTS.UPDATED);
    console.log('[ProductService] Evento emitido');
    
    return newProduct;
  } catch (error) {
    console.error('[ProductService] Erro ao salvar produto:', error);
    throw new Error(`Falha ao salvar produto: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getProducts(): Promise<Product[]> {
  console.log('[ProductService] Iniciando busca de produtos');
  
  try {
    console.log('[ProductService] Acessando AsyncStorage com chave:', STORAGE_KEY);
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    console.log('[ProductService] Dados obtidos do AsyncStorage:', data ? 'Dados encontrados' : 'Nenhum dado');
    
    if (!data) {
      console.log('[ProductService] Nenhum produto encontrado, retornando array vazio');
      return [];
    }
    
    console.log('[ProductService] Convertendo dados JSON para objetos');
    const products: Product[] = JSON.parse(data);
    console.log('[ProductService] Produtos carregados (antes do formatação):', products.length);
    
    console.log('[ProductService] Formatando datas dos produtos');
    const formattedProducts = products.map(product => ({
      ...product,
      expirationDate: new Date(product.expirationDate),
      createdAt: new Date(product.createdAt),
      updatedAt: product.updatedAt ? new Date(product.updatedAt) : undefined,
    }));
    
    console.log('[ProductService] Produtos carregados com sucesso:', formattedProducts.length);
    if (formattedProducts.length > 0) {
      console.log('[ProductService] Primeiro produto:', JSON.stringify(formattedProducts[0], null, 2));
    }
    
    return formattedProducts;
  } catch (error) {
    console.error('[ProductService] Erro ao processar produtos:', error);
    return [];
  }
}

export async function updateProduct(product: Product): Promise<void> {
  console.log('[ProductService] Atualizando produto:', product);
  const products = await getProducts();
  const index = products.findIndex(p => p.code === product.code);
  
  if (index >= 0) {
    products[index] = {
      ...product,
      updatedAt: new Date()
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    console.log('[ProductService] Produto atualizado, emitindo evento');
    eventEmitter.emit(PRODUCT_EVENTS.UPDATED);
  } else {
    console.warn('[ProductService] Produto não encontrado para atualização:', product.code);
  }
}

export async function deleteProduct(code: string): Promise<void> {
  console.log('[ProductService] Deletando produto:', code);
  const products = await getProducts();
  const filtered = products.filter(p => p.code !== code);
  
  if (filtered.length < products.length) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    console.log('[ProductService] Produto deletado, emitindo evento');
    eventEmitter.emit(PRODUCT_EVENTS.UPDATED);
  } else {
    console.warn('[ProductService] Produto não encontrado para deleção:', code);
  }
}

export async function markProductAsSold(code: string): Promise<void> {
  console.log('[ProductService] Marcando produto como vendido:', code);
  const products = await getProducts();
  const index = products.findIndex(p => p.code === code);
  
  if (index >= 0) {
    const product = products[index];
    const updatedProduct = {
      ...product,
      isSold: true,
      updatedAt: new Date()
    };
    products[index] = updatedProduct;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    console.log('[ProductService] Produto atualizado, emitindo evento');
    eventEmitter.emit(PRODUCT_EVENTS.UPDATED);
    
    // Cancelar notificações para este produto
    try {
      await cancelProductNotifications(code);
      console.log('[ProductService] Notificações canceladas para produto vendido:', code);
    } catch (error) {
      console.error('[ProductService] Erro ao cancelar notificações do produto vendido:', error);
    }
  } else {
    console.warn('[ProductService] Produto não encontrado para marcação como vendido:', code);
  }
} 