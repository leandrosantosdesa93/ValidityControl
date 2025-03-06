import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/product';
import { differenceInDays, isAfter, isBefore, startOfDay, addDays, isSameDay } from 'date-fns';

interface NotificationSettings {
  enabled: boolean;
  quietHours: boolean;
  quietHoursStart: number; // hora em 24h format (0-23)
  quietHoursEnd: number; // hora em 24h format (0-23)
  notificationDays: number[]; // dias antes para notificar
  groupNotifications: boolean;
  soundEnabled: boolean;
  productNotifications: { [key: string]: boolean };
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  quietHours: false,
  quietHoursStart: 22,
  quietHoursEnd: 7,
  notificationDays: [5, 4, 3, 2, 1], // Dias de 1 a 5
  groupNotifications: true,
  soundEnabled: true,
  productNotifications: {},
};

interface ProductState {
  products: Product[];
  notificationSettings: NotificationSettings;
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (code: string) => void;
  toggleFavorite: (code: string) => void;
  toggleProductNotification: (code: string) => void;
  toggleQuietHours: () => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  getExpiringProducts: () => Product[];
  getExpiredProducts: () => Product[];
  exportToCSV: () => Promise<string>;
  cleanupExpiredProducts: () => void;
  clearStore: () => void;
}

const storage = {
  getItem: async (name: string): Promise<string | null> => {
    console.log('[Storage] Obtendo item:', name);
    try {
      const value = await AsyncStorage.getItem(name);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          console.log('[Storage] Dados obtidos e parseados:', {
            hasProducts: !!parsed?.state?.products?.length,
            hasSettings: !!parsed?.state?.notificationSettings,
            settings: parsed?.state?.notificationSettings
          });
        } catch (e) {
          console.error('[Storage] Erro ao parsear dados:', e);
        }
      } else {
        console.log('[Storage] Nenhum dado encontrado');
      }
      return value;
    } catch (error) {
      console.error('[Storage] Erro ao obter item:', error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    console.log('[Storage] Salvando item:', name);
    try {
      const parsed = JSON.parse(value);
      console.log('[Storage] Validando dados antes de salvar:', {
        hasProducts: !!parsed?.state?.products?.length,
        hasSettings: !!parsed?.state?.notificationSettings,
        settings: parsed?.state?.notificationSettings
      });
      
      // Validação adicional dos dados
      if (parsed?.state?.notificationSettings) {
        const settings = parsed.state.notificationSettings;
        console.log('[Storage] Validando configurações:', {
          quietHours: settings.quietHours,
          quietHoursStart: settings.quietHoursStart,
          quietHoursEnd: settings.quietHoursEnd,
          notificationDays: settings.notificationDays,
        });
      }

      await AsyncStorage.setItem(name, value);
      console.log('[Storage] Dados salvos com sucesso');
    } catch (error) {
      console.error('[Storage] Erro ao salvar item:', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    console.log('[Storage] Removendo item:', name);
    try {
      await AsyncStorage.removeItem(name);
      console.log('[Storage] Item removido com sucesso');
    } catch (error) {
      console.error('[Storage] Erro ao remover item:', error);
    }
  },
};

export const useProductStore = create<ProductState>()(
  persist(
    (set, get) => ({
      products: [],
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,

      addProduct: (product) => {
        console.log('[Store] Adicionando produto:', product);
        set((state) => ({
          products: [...state.products, {
            ...product,
            updatedAt: new Date().toISOString(),
            isFavorite: false
          }],
          notificationSettings: {
            ...state.notificationSettings,
            productNotifications: {
              ...state.notificationSettings.productNotifications,
              [product.code]: true,
            },
          },
        }));
      },

      updateProduct: (product) => {
        console.log('[Store] Atualizando produto:', product);
        set((state) => ({
          products: state.products.map(p => 
            p.code === product.code ? {
              ...product,
              updatedAt: new Date().toISOString()
            } : p
          ),
        }));
      },

      deleteProduct: (code) => {
        console.log('[Store] Deletando produto:', code);
        const productNotifications = { ...get().notificationSettings.productNotifications };
        delete productNotifications[code];
        
        set((state) => ({
          products: state.products.filter(p => p.code !== code),
          notificationSettings: {
            ...state.notificationSettings,
            productNotifications,
          },
        }));
      },

      toggleFavorite: (code) => {
        console.log('[Store] Alternando favorito:', code);
        set((state) => ({
          products: state.products.map(p => 
            p.code === code ? { ...p, isFavorite: !p.isFavorite } : p
          ),
        }));
      },

      toggleProductNotification: (code) => {
        console.log('[Store] Alternando notificação do produto:', code);
        set((state) => ({
          notificationSettings: {
            ...state.notificationSettings,
            productNotifications: {
              ...state.notificationSettings.productNotifications,
              [code]: !state.notificationSettings.productNotifications[code],
            },
          },
        }));
      },

      toggleQuietHours: () => {
        console.log('[Store] Alternando modo silencioso');
        set((state) => {
          const currentSettings = state.notificationSettings;
          console.log('[Store] Configurações atuais:', currentSettings);
          
          const newSettings = {
            ...currentSettings,
            quietHours: !currentSettings.quietHours,
          };
          
          console.log('[Store] Novas configurações:', newSettings);
          return { 
            ...state,
            notificationSettings: newSettings 
          };
        });
      },

      setNotificationsEnabled: (enabled) => {
        console.log('[Store] Definindo notificações:', enabled);
        set((state) => {
          const newSettings = {
            ...state.notificationSettings,
            enabled,
          };
          console.log('[Store] Novas configurações:', newSettings);
          return { notificationSettings: newSettings };
        });
      },

      updateNotificationSettings: (settings) => {
        console.log('[Store] Atualizando configurações:', settings);
        set((state) => {
          const currentSettings = state.notificationSettings;
          console.log('[Store] Configurações atuais:', currentSettings);
          
          const newSettings = {
            ...currentSettings,
            ...settings,
          };
          
          // Validação dos valores
          if (typeof newSettings.quietHoursStart === 'number') {
            newSettings.quietHoursStart = Math.max(0, Math.min(23, newSettings.quietHoursStart));
          }
          if (typeof newSettings.quietHoursEnd === 'number') {
            newSettings.quietHoursEnd = Math.max(0, Math.min(23, newSettings.quietHoursEnd));
          }
          if (Array.isArray(newSettings.notificationDays)) {
            newSettings.notificationDays = newSettings.notificationDays
              .filter(day => typeof day === 'number' && day > 0)
              .sort((a, b) => b - a);
          }
          
          console.log('[Store] Novas configurações após validação:', newSettings);
          return { 
            ...state,
            notificationSettings: newSettings 
          };
        });
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
            return differenceInDays(expirationDate, today) < 0;
          } catch (error) {
            console.error('[Store] Erro ao processar data de expiração:', error);
            return false;
          }
        });
      },

      exportToCSV: async () => {
        const { products } = get();
        const headers = ['Código', 'Descrição', 'Quantidade', 'Validade', 'Favorito', 'Criado em'];
        const rows = products.map(p => [
          p.code,
          p.description,
          p.quantity.toString(),
          p.expirationDate.toISOString(),
          p.isFavorite ? 'Sim' : 'Não',
          p.createdAt.toISOString(),
        ]);

        const csv = [
          headers.join(','),
          ...rows.map(row => row.join(',')),
        ].join('\n');

        return csv;
      },

      cleanupExpiredProducts: () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        set((state) => ({
          products: state.products.filter(p => 
            isAfter(p.expirationDate, thirtyDaysAgo)
          ),
        }));
      },

      clearStore: () => {
        console.log('[Store] Limpando store...');
        set({ 
          products: [],
          notificationSettings: DEFAULT_NOTIFICATION_SETTINGS
        });
      }
    }),
    {
      name: 'product-storage',
      storage: createJSONStorage(() => storage),
      partialize: (state) => {
        console.log('[Store] Preparando estado para persistência:', {
          productsCount: state.products.length,
          settings: state.notificationSettings
        });
        return {
          products: state.products,
          notificationSettings: state.notificationSettings
        };
      },
      onRehydrateStorage: () => (state) => {
        console.log('[Store] Iniciando rehidratação do estado');
        if (!state) {
          console.log('[Store] Nenhum estado encontrado para rehidratar');
          return;
        }

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

          // Validação e merge das configurações
          if (state.notificationSettings) {
            const mergedSettings = {
              ...DEFAULT_NOTIFICATION_SETTINGS,
              ...state.notificationSettings,
            };

            // Validação específica para cada campo
            mergedSettings.quietHoursStart = Math.max(0, Math.min(23, mergedSettings.quietHoursStart));
            mergedSettings.quietHoursEnd = Math.max(0, Math.min(23, mergedSettings.quietHoursEnd));
            mergedSettings.notificationDays = Array.isArray(mergedSettings.notificationDays) 
              ? mergedSettings.notificationDays.filter(day => typeof day === 'number' && day > 0).sort((a, b) => b - a)
              : DEFAULT_NOTIFICATION_SETTINGS.notificationDays;
            mergedSettings.productNotifications = typeof mergedSettings.productNotifications === 'object'
              ? mergedSettings.productNotifications
              : {};

            state.notificationSettings = mergedSettings;
          } else {
            console.error('[Store] Estado inválido para configurações:', state.notificationSettings);
            state.notificationSettings = DEFAULT_NOTIFICATION_SETTINGS;
          }

          console.log('[Store] Estado final após rehidratação:', {
            productsCount: state.products.length,
            settings: state.notificationSettings
          });
        } catch (error) {
          console.error('[Store] Erro durante a rehidratação:', error);
          // Em caso de erro, retorna ao estado padrão
          state.products = [];
          state.notificationSettings = DEFAULT_NOTIFICATION_SETTINGS;
        }
      }
    }
  )
);