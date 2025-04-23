import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/Product';
import { isAfter, isBefore, startOfDay, addDays, isSameDay } from 'date-fns';

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
  deleteProduct: (code: string) => void;
  deleteMultipleProducts: (codes: string[]) => void;
  getFilteredProducts: (
    query: string, 
    filterExpired?: boolean, 
    filterExpiring?: boolean
  ) => Product[];
  
  // Loading state
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Stats update
  updateStats: () => void;
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
        const today = startOfDay(new Date());
        const fiveDaysFromNow = addDays(today, 6);
        
        const stats = {
          expired: products.filter(p => isBefore(new Date(p.expirationDate), today)).length,
          expiring: products.filter(p => {
            const expDate = new Date(p.expirationDate);
            return (isSameDay(expDate, today) || isAfter(expDate, today)) && 
                   isBefore(expDate, fiveDaysFromNow);
          }).length,
          valid: products.filter(p => isAfter(new Date(p.expirationDate), fiveDaysFromNow)).length,
          total: products.length,
          monthlyData: products.reduce((acc, p) => {
            const month = new Date(p.expirationDate).toLocaleString('pt-BR', { month: 'long' });
            acc[month] = (acc[month] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        };
        
        set({ stats });
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
          const index = state.products.findIndex(p => p.code === updatedProduct.code);
          if (index === -1) return state;
          
          const newProducts = [...state.products];
          newProducts[index] = updatedProduct;
          return { products: newProducts };
        });
        get().updateStats();
      },
      
      deleteProduct: (code) => {
        set((state) => {
          const newProducts = state.products.filter(p => p.code !== code);
          return { products: newProducts };
        });
        get().updateStats();
      },
      
      deleteMultipleProducts: (codes) => {
        set((state) => {
          const newProducts = state.products.filter(p => !codes.includes(p.code));
          return { products: newProducts };
        });
        get().updateStats();
      },
      
      getFilteredProducts: (query, filterExpired = false, filterExpiring = false) => {
        const { products } = get();
        const today = startOfDay(new Date());
        const fiveDaysFromNow = addDays(today, 6);
        
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
            const expDate = new Date(product.expirationDate);
            const isExpired = isBefore(expDate, today);
            const isExpiring = (isSameDay(expDate, today) || isAfter(expDate, today)) && 
                             isBefore(expDate, fiveDaysFromNow);
            
            if (filterExpired && !isExpired) return false;
            if (filterExpiring && !isExpiring) return false;
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
  const logMiddleware = (_config: any) => (next: any) => (args: any) => {
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

  useProductsStore.subscribe(logMiddleware);
} 