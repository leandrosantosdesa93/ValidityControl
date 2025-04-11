import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/Product';
import { differenceInDays, isAfter, isBefore, startOfDay, addDays, isSameDay } from 'date-fns';

interface ProductState {
  products: Product[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (code: string) => void;
  toggleFavorite: (code: string) => void;
  getExpiringProducts: () => Product[];
  getExpiredProducts: () => Product[];
  exportToCSV: () => Promise<string>;
  cleanupExpiredProducts: () => void;
  clearStore: () => void;
}

const storage = {
  getItem: async (name: string): Promise<string | null> => {
    return await AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await AsyncStorage.removeItem(name);
  },
};

export const useProductStore = create<ProductState>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (product) => {
        set((state) => ({
          products: [...state.products, product],
        }));
      },

      updateProduct: (product) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.code === product.code ? product : p
          ),
        }));
      },

      deleteProduct: (code) => {
        set((state) => ({
          products: state.products.filter((p) => p.code !== code),
        }));
      },

      toggleFavorite: (code) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.code === code ? { ...p, isFavorite: !p.isFavorite } : p
          ),
        }));
      },

      getExpiringProducts: () => {
        const { products } = get();
        const today = startOfDay(new Date());
        const fiveDaysFromNow = addDays(today, 6);
        
        return products.filter(product => {
          if (!product?.expirationDate) return false;
          try {
            const expirationDate = startOfDay(new Date(product.expirationDate));
            return (isSameDay(expirationDate, today) || isAfter(expirationDate, today)) && 
                   isBefore(expirationDate, fiveDaysFromNow);
          } catch (error) {
            console.error('[Store] Erro ao processar data de expiração:', error);
            return false;
          }
        });
      },

      getExpiredProducts: () => {
        const { products } = get();
        const today = startOfDay(new Date());
        
        return products.filter(product => {
          if (!product?.expirationDate) return false;
          try {
            const expirationDate = startOfDay(new Date(product.expirationDate));
            return isBefore(expirationDate, today);
          } catch (error) {
            console.error('[Store] Erro ao processar data de expiração:', error);
            return false;
          }
        });
      },

      exportToCSV: async () => {
        const { products } = get();
        const headers = ['Código', 'Descrição', 'Data de Validade', 'Quantidade', 'Vendido', 'Favorito'];
        const rows = products.map(p => [
          p.code,
          p.description,
          new Date(p.expirationDate).toLocaleDateString('pt-BR'),
          p.quantity.toString(),
          p.isSold ? 'Sim' : 'Não',
          p.isFavorite ? 'Sim' : 'Não'
        ]);
        
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.join(','))
        ].join('\n');
        
        return csvContent;
      },

      cleanupExpiredProducts: () => {
        const { products } = get();
        const today = startOfDay(new Date());
        
        set({
          products: products.filter(product => {
            if (!product?.expirationDate) return true;
            try {
              const expirationDate = startOfDay(new Date(product.expirationDate));
              return !isBefore(expirationDate, today) || !product.isSold;
            } catch (error) {
              console.error('[Store] Erro ao processar data de expiração:', error);
              return true;
            }
          })
        });
      },

      clearStore: () => {
        set({ products: [] });
      },
    }),
    {
      name: '@ValidityControl:products',
      storage: createJSONStorage(() => storage),
      onRehydrateStorage: () => (state) => {
        try {
          // Validação e conversão dos produtos
          if (Array.isArray(state.products)) {
            state.products = state.products.map(product => ({
              ...product,
              expirationDate: product.expirationDate ? new Date(product.expirationDate) : null,
              createdAt: product.createdAt ? new Date(product.createdAt) : new Date(),
              updatedAt: product.updatedAt ? new Date(product.updatedAt) : new Date()
            }));
          } else {
            console.error('[Store] Estado inválido para produtos:', state.products);
            state.products = [];
          }
        } catch (error) {
          console.error('[Store] Erro ao recarregar estado:', error);
          state.products = [];
        }
      },
    }
  )
);