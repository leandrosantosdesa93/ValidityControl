import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/Product';
import { getExpirationInfo, getExpirationStats, getMonthlyExpirationData } from '@/utils/expiration';

interface ProductsState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  
  // Stats
  stats: {
    expired: number;
    expiring: number;
    valid: number;
    total: number;
    monthlyData: Record<string, number>;
  };
  
  // Actions
  addProduct: (product: Product) => void;
  updateProduct: (updatedProduct: Product) => void;
  deleteProduct: (id: string) => void;
  deleteMultipleProducts: (ids: string[]) => void;
  getFilteredProducts: (
    query: string, 
    filterExpired?: boolean, 
    filterExpiring?: boolean
  ) => Product[];
  
  // Loading state
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useProductsStore = create<ProductsState>()(
  persist(
    (set, get) => ({
      products: [],
      isLoading: false,
      error: null,
      
      stats: {
        expired: 0,
        expiring: 0,
        valid: 0,
        total: 0,
        monthlyData: {},
      },
      
      // Update stats whenever products change
      updateStats: () => {
        const products = get().products;
        const { expired, expiring, valid } = getExpirationStats(products);
        const monthlyData = getMonthlyExpirationData(products);
        
        set({
          stats: {
            expired,
            expiring,
            valid,
            total: products.length,
            monthlyData,
          }
        });
      },
      
      // Actions
      addProduct: (product) => {
        set((state) => {
          const newProducts = [...state.products, product];
          return { products: newProducts };
        });
        get().updateStats();
      },
      
      updateProduct: (updatedProduct) => {
        set((state) => {
          const index = state.products.findIndex(p => p.id === updatedProduct.id);
          if (index === -1) return state;
          
          const newProducts = [...state.products];
          newProducts[index] = updatedProduct;
          return { products: newProducts };
        });
        get().updateStats();
      },
      
      deleteProduct: (id) => {
        set((state) => {
          const newProducts = state.products.filter(p => p.id !== id);
          return { products: newProducts };
        });
        get().updateStats();
      },
      
      deleteMultipleProducts: (ids) => {
        set((state) => {
          const newProducts = state.products.filter(p => !ids.includes(p.id));
          return { products: newProducts };
        });
        get().updateStats();
      },
      
      getFilteredProducts: (query, filterExpired = false, filterExpiring = false) => {
        const { products } = get();
        
        return products.filter(product => {
          // Filter by query
          const searchTerms = query.toLowerCase().split(' ');
          const productMatches = searchTerms.every(term => {
            return (
              product.code.toLowerCase().includes(term) || 
              product.description.toLowerCase().includes(term) ||
              new Date(product.expirationDate)
                .toLocaleDateString('pt-BR')
                .includes(term)
            );
          });
          
          if (!productMatches) return false;
          
          // Filter by expiration
          if (filterExpired || filterExpiring) {
            const { isExpired, daysRemaining } = getExpirationInfo(product.expirationDate);
            
            if (filterExpired && !isExpired) return false;
            if (filterExpiring && (!(!isExpired && daysRemaining <= 30) || isExpired)) return false;
          }
          
          return true;
        });
      },
      
      // Loading state
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'products-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.updateStats();
        }
      },
    }
  )
);

// Middleware para registrar ações
if (__DEV__) {
  const originalUseProductsStore = useProductsStore;
  
  const logMiddleware = (config: any) => (next: any) => (args: any) => {
    const stateBeforeAction = useProductsStore.getState();
    console.log('Action:', args);
    const result = next(args);
    const stateAfterAction = useProductsStore.getState();
    console.log('State Changed:', {
      before: stateBeforeAction.products.length,
      after: stateAfterAction.products.length
    });
    return result;
  };
} 