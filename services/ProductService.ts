import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { eventEmitter, PRODUCT_EVENTS } from './EventEmitter';

// Chave para armazenamento dos produtos
const STORAGE_KEY = 'product-storage';

// Interface para os dados do formulário
type ProductFormData = {
  description: string;
  expirationDate: Date;
  quantity: number;
  photoUri?: string;
  code?: string; // Código personalizado opcional (deve ter o formato PROD-XXXX)
};

// Interface para o storage
interface ProductStorage {
  products: Product[];
  hasProducts: boolean;
}

// Interface para o produto completo
export interface Product {
  code: string;
  description: string;
  expirationDate: string; // Armazenada como string para compatibilidade
  quantity: number;
  photoUri?: string;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  name?: string; // Tornar opcional já que não está no schema
}

// Função para salvar um produto
export async function saveProduct(formData: ProductFormData): Promise<Product> {
  try {
    console.log('[ProductService] Iniciando processo de salvar produto');
    
    if (!formData) {
      throw new Error('Dados do formulário estão vazios');
    }
    
    // Imprimir os dados recebidos para debug
    console.log('[ProductService] Dados recebidos:', JSON.stringify(formData, null, 2));
    
    // Verificar valores obrigatórios
    if (!formData.description) {
      throw new Error('Descrição do produto é obrigatória');
    }
    
    if (!formData.expirationDate) {
      throw new Error('Data de validade é obrigatória');
    }
    
    if (formData.quantity <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }
    
    // Verificar se o código do produto foi fornecido
    if (!formData.code || formData.code.trim() === '') {
      throw new Error('Código do produto é obrigatório');
    }
    
    // Recuperar produtos existentes
    let storage: ProductStorage = { products: [], hasProducts: false };
    try {
      console.log('[ProductService] Tentando recuperar produtos existentes');
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      console.log('[ProductService] Dados recuperados do AsyncStorage:', existingData ? 'dados encontrados' : 'nenhum dado');
      
      if (existingData) {
        const parsedData = JSON.parse(existingData);
        console.log('[ProductService] Dados parseados com sucesso');
        if (parsedData && typeof parsedData === 'object') {
          storage = parsedData;
          console.log('[ProductService] Storage carregado com', 
            Array.isArray(storage.products) ? storage.products.length : 0, 'produtos');
        }
      } else {
        console.log('[ProductService] Nenhum dado existente. Criando novo storage.');
      }
    } catch (error) {
      console.error('[ProductService] Erro ao ler produtos existentes:', error);
      // Continue com um storage vazio se não conseguir ler
      storage = { products: [], hasProducts: false };
      console.log('[ProductService] Usando storage vazio devido a erro.');
    }
    
    // Garantir que storage.products é um array
    if (!Array.isArray(storage.products)) {
      console.log('[ProductService] storage.products não é um array. Inicializando.');
      storage.products = [];
    }
    
    // Criar novo produto
    console.log('[ProductService] Criando novo produto');
    const now = new Date();
    
    // Log para depuração de código personalizado
    console.log('[ProductService] Código personalizado recebido:', formData.code);
    
    // Extrair componentes da data diretamente para evitar problemas de fuso horário
    let expirationDateString: string;
    if (formData.expirationDate instanceof Date) {
      const date = new Date(formData.expirationDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      expirationDateString = `${year}-${month}-${day}`;
      console.log('[ProductService] Data de validade convertida:', expirationDateString);
    } else {
      expirationDateString = formData.expirationDate.toString();
    }
    
    // Determinar o código do produto
    let productCode = formData.code;
    
    // Verificar se o código está presente
    if (!productCode) {
      console.error('[ProductService] ERRO: Nenhum código de produto foi fornecido!');
      throw new Error('Código do produto é obrigatório');
    }
    
    // Garantir que o código do produto tenha o prefixo PROD- (segurança extra)
    if (productCode && !productCode.startsWith('PROD-')) {
      const oldCode = productCode;
      productCode = `PROD-${productCode}`;
      console.log(`[ProductService] Prefixo PROD- adicionado ao código: ${oldCode} -> ${productCode}`);
    }
    
    console.log('[ProductService] Código final do produto a ser salvo:', productCode);
    
    const product: Product = {
      code: productCode, // Usar código personalizado se fornecido
      description: formData.description,
      name: formData.description, // Usando description como name também
      expirationDate: expirationDateString, // Armazene como string ISO para compatibilidade
      quantity: formData.quantity,
      photoUri: formData.photoUri,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    };
    
    // Verificação adicional do código
    if (product.code !== productCode) {
      console.error('[ProductService] ERRO: O código do produto não foi atribuído corretamente!');
      console.error(`[ProductService] Esperado: ${productCode}, Recebido: ${product.code}`);
      // Forçar a atribuição correta
      product.code = productCode;
    }
    
    console.log('[ProductService] Produto criado:', JSON.stringify(product, null, 2));
    
    // Adicionar à lista de produtos
    storage.products.push(product);
    storage.hasProducts = true;
    
    console.log('[ProductService] Produto adicionado ao storage. Total produtos:', storage.products.length);
    
    // Salvar de volta no AsyncStorage
    const jsonToSave = JSON.stringify(storage, (key, value) => {
      // Converter objetos Date para strings no formato ISO
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
    
    await AsyncStorage.setItem(STORAGE_KEY, jsonToSave);
    console.log('[ProductService] Produto salvo com sucesso no AsyncStorage');
    
    // Emitir evento de atualização
    eventEmitter.emit(PRODUCT_EVENTS.UPDATED);
    console.log('[ProductService] Evento UPDATED emitido');
    
    // Verificação final do código antes de retornar
    if (product.code !== productCode) {
      console.error('[ProductService] ERRO: Código final do produto diferente do esperado!');
      console.error(`[ProductService] Esperado: ${productCode}, Retornando: ${product.code}`);
      // Forçar o código correto antes de retornar
      product.code = productCode;
    }
    
    return product;
  } catch (error) {
    console.error('[ProductService] Erro ao salvar produto:', error);
    throw new Error(`Falha ao salvar produto: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Função para obter todos os produtos
export async function getProducts(): Promise<Product[]> {
  try {
    console.log('[ProductService] Iniciando busca de produtos');
    
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    console.log('[ProductService] Dados recuperados do AsyncStorage:', data ? 'dados encontrados' : 'nenhum dado');
    
    if (!data) {
      console.log('[ProductService] Nenhum dado encontrado, retornando array vazio');
      return [];
    }
    
    console.log('[ProductService] Convertendo dados para objeto');
    const storage = JSON.parse(data, (key, value) => {
      // Converter strings de data para objetos Date apenas para createdAt e updatedAt
      if (key === 'createdAt' || key === 'updatedAt') {
        if (typeof value === 'string') {
          return new Date(value);
        }
      }
      return value;
    }) as ProductStorage;
    
    console.log('[ProductService] Verificando se products é um array');
    const products = Array.isArray(storage.products) ? storage.products : [];
    
    console.log('[ProductService] Produtos carregados com sucesso:', products.length);
    
    // Verifique os produtos para debugging
    if (products.length > 0) {
      console.log('[ProductService] Primeiro produto:', JSON.stringify(products[0], null, 2));
    }
    
    return products;
  } catch (error) {
    console.error('[ProductService] Erro ao buscar produtos:', error);
    return [];
  }
}

export async function updateProduct(product: Product): Promise<void> {
  console.log('[ProductService] Atualizando produto:', product);
  try {
    // Obter o storage atual
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    let storage: ProductStorage = { products: [], hasProducts: false };
    
    if (data) {
      storage = JSON.parse(data, (key, value) => {
        // Converter strings de data para objetos Date apenas para createdAt e updatedAt
        if (key === 'createdAt' || key === 'updatedAt') {
          if (typeof value === 'string') {
            return new Date(value);
          }
        }
        return value;
      }) as ProductStorage;
    }
    
    // Encontrar e atualizar o produto
    const index = storage.products.findIndex(p => p.code === product.code);
    
    if (index >= 0) {
      // Garantir que expirationDate seja string no formato correto
      let expirationDateString: string = product.expirationDate as string;
      
      if (product.expirationDate instanceof Date) {
        // Criar uma data com UTC para evitar problemas de fuso horário
        const date = new Date(product.expirationDate);
        // Extrair os componentes da data diretamente para evitar problemas de fuso horário
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        expirationDateString = `${year}-${month}-${day}`;
        console.log('[ProductService] Data convertida:', expirationDateString);
      }
      
      storage.products[index] = {
        ...product,
        expirationDate: expirationDateString,
        updatedAt: new Date()
      };
      
      // Salvar de volta no AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storage, (key, value) => {
        // Converter objetos Date para strings no formato ISO
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }));
      
      console.log('[ProductService] Produto atualizado com sucesso');
      // Emitir evento de atualização
      eventEmitter.emit(PRODUCT_EVENTS.UPDATED);
    } else {
      console.warn('[ProductService] Produto não encontrado para atualização:', product.code);
    }
  } catch (error) {
    console.error('[ProductService] Erro ao atualizar produto:', error);
    throw new Error('Falha ao atualizar produto');
  }
}

export async function deleteProduct(code: string): Promise<void> {
  console.log('[ProductService] Deletando produto:', code);
  try {
    // Obter o storage atual
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    let storage: ProductStorage = { products: [], hasProducts: false };
    
    if (data) {
      storage = JSON.parse(data) as ProductStorage;
    }
    
    // Filtrar o produto a ser removido
    const initialLength = storage.products.length;
    storage.products = storage.products.filter(p => p.code !== code);
    storage.hasProducts = storage.products.length > 0;
    
    if (storage.products.length < initialLength) {
      // Salvar de volta no AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
      console.log('[ProductService] Produto deletado com sucesso');
      // Emitir evento de atualização
      eventEmitter.emit(PRODUCT_EVENTS.UPDATED);
    } else {
      console.warn('[ProductService] Produto não encontrado para deleção:', code);
    }
  } catch (error) {
    console.error('[ProductService] Erro ao deletar produto:', error);
    throw new Error('Falha ao deletar produto');
  }
}

// Função para obter um produto específico pelo código
export async function getProductByCode(code: string): Promise<Product | null> {
  console.log('[ProductService] Buscando produto por código:', code);
  try {
    // Recuperar todos os produtos
    const products = await getProducts();
    
    // Encontrar o produto específico
    const product = products.find(p => p.code === code);
    
    if (product) {
      console.log('[ProductService] Produto encontrado:', JSON.stringify(product, null, 2));
      return product;
    } else {
      console.log('[ProductService] Produto não encontrado para o código:', code);
      return null;
    }
  } catch (error) {
    console.error('[ProductService] Erro ao buscar produto por código:', error);
    return null;
  }
}

// Função para marcar um produto como vendido
export async function markAsSold(code: string): Promise<void> {
  try {
    console.log('[ProductService] Marcando produto como vendido (nova implementação):', code);
    
    // Obter o storage atual
    const storageStr = await AsyncStorage.getItem(STORAGE_KEY);
    
    if (!storageStr) {
      console.warn('[ProductService] Nenhum produto encontrado no storage para marcar como vendido');
      return;
    }
    
    // Converter o storage para objeto
    const storage: ProductStorage = JSON.parse(storageStr);
    
    // Filtrar o produto a ser marcado como vendido
    const updatedProducts = storage.products.filter(p => p.code !== code);
    
    // Atualizar o flag de hasProducts
    const hasProducts = updatedProducts.length > 0;
    
    // Atualizar o storage
    const updatedStorage: ProductStorage = {
      products: updatedProducts,
      hasProducts
    };
    
    // Salvar o storage atualizado
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStorage));
    
    // Emitir evento de produto atualizado
    eventEmitter.emit(PRODUCT_EVENTS.UPDATED, { action: 'sold', productCode: code });
    
    console.log(`[ProductService] Produto ${code} marcado como vendido e removido com sucesso`);
  } catch (error) {
    console.error('[ProductService] Erro ao marcar produto como vendido:', error);
    throw new Error(`Não foi possível marcar o produto como vendido: ${error instanceof Error ? error.message : String(error)}`);
  }
} 