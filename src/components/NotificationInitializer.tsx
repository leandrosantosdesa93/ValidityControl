import React, { useEffect, useState } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useProductStore } from '../store/productStore';
import {
  initializeNotifications,
  refreshAllNotifications,
  cancelProductNotifications,
  scheduleAllProductNotifications
} from '../services/notifications';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import * as SplashScreen from 'expo-splash-screen';

// Configurar o handler global de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX
  }),
});

export function NotificationInitializer() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStatus, setInitStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  
  // Acesso ao store
  const store = useProductStore();
  const settings = store.notificationSettings;
  const products = store.products;

  // Inicializar o sistema de atualização automática
  useEffect(() => {
    try {
      // Inicializar o sistema de atualização automaticamente
      useAutoUpdate().catch(error => {
        console.warn('[NotificationInitializer] Erro no autoUpdate:', error);
      });
    } catch (error) {
      console.warn('[NotificationInitializer] Erro ao inicializar autoUpdate:', error);
    }
  }, []);

  // Monitorar mudanças no estado do aplicativo
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('[NotificationInitializer] Estado do aplicativo mudou para:', nextAppState);
      
      // Se o app está retornando para o primeiro plano
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[NotificationInitializer] Aplicativo voltou para o primeiro plano');
        
        // Fazer uma reverificação das notificações
        if (settings.enabled && !isInitializing) {
          console.log('[NotificationInitializer] Reagendando notificações após retorno ao primeiro plano');
          scheduleAllProductNotifications().catch(error => {
            console.error('[NotificationInitializer] Erro ao reagendar notificações:', error);
          });
        }
      }
      
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState, settings.enabled, isInitializing]);

  // Configurar listener para notificações recebidas
  useEffect(() => {
    console.log('[NotificationInitializer] Configurando listeners de notificações...');
    
    // Listener para notificações recebidas com o app em primeiro plano
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('[NotificationInitializer] Notificação recebida em primeiro plano:', notification);
    });

    // Listener para notificações clicadas
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[NotificationInitializer] Usuário interagiu com notificação:', response);
      
      // Aqui você pode adicionar navegação para a tela relevante
      const data = response.notification.request.content.data;
      console.log('[NotificationInitializer] Dados da notificação:', data);
      
      // Verificar se o produto já foi vendido
      const productId = data.productId as string;
      if (productId) {
        const product = store.products.find(p => p.code === productId);
        if (product?.isSold) {
          console.log('[NotificationInitializer] Produto já foi vendido, cancelando notificações:', productId);
          cancelProductNotifications(productId);
        }
      }
    });

    // Inicializar notificações
    const setupNotificationSystem = async () => {
      try {
        setInitStatus('loading');
        console.log('[NotificationInitializer] Iniciando setup de notificações...');
        
        // Solicitar permissões e verificar estado atual
        const { status } = await Notifications.getPermissionsAsync();
        console.log('[NotificationInitializer] Status atual de permissões:', status);
        
        // Verificar notificações agendadas atualmente
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        console.log('[NotificationInitializer] Notificações agendadas atualmente:', scheduled.length);
        
        // Inicializar o sistema de notificações
        const success = await initializeNotifications();
        
        if (success) {
          console.log('[NotificationInitializer] Notificações inicializadas com sucesso');
          
          // Para Android, verificar se é necessário reagendar
          if (Platform.OS === 'android' && settings.enabled && products.length > 0) {
            console.log('[NotificationInitializer] Reagendando notificações para Android...');
            
            // Certificar que todas as notificações são reagendadas
            scheduleAllProductNotifications().catch(error => {
              console.error('[NotificationInitializer] Erro ao agendar notificações:', error);
            });
          }
          
          setInitStatus('success');
        } else {
          console.warn('[NotificationInitializer] Falha ao inicializar notificações');
          setInitStatus('error');
        }
      } catch (error) {
        console.error('[NotificationInitializer] Erro ao configurar notificações:', error);
        setInitStatus('error');
      } finally {
        setIsInitializing(false);
        
        // Esconder a splash screen depois da inicialização
        try {
          await SplashScreen.hideAsync();
        } catch (error) {
          console.warn('[NotificationInitializer] Erro ao esconder splash screen:', error);
        }
      }
    };

    setupNotificationSystem();

    // Limpar listeners ao desmontar
    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  // Atualizar notificações quando as configurações mudarem
  useEffect(() => {
    // Só atualizar se já inicializamos e as notificações estão habilitadas
    if (!isInitializing && settings.enabled) {
      console.log('[NotificationInitializer] Configurações de notificação alteradas, atualizando...');
      refreshAllNotifications()
        .then(success => {
          console.log('[NotificationInitializer] Notificações atualizadas com sucesso:', success);
          
          // Para Android, reagendar explicitamente 
          if (Platform.OS === 'android') {
            return scheduleAllProductNotifications();
          }
        })
        .catch(error => {
          console.error('[NotificationInitializer] Erro ao atualizar notificações:', error);
        });
    }
  }, [settings, isInitializing]);

  // Reagendar notificações quando a lista de produtos mudar
  useEffect(() => {
    if (!isInitializing && settings.enabled && products.length > 0) {
      console.log('[NotificationInitializer] Lista de produtos alterada, reagendando notificações...');
      scheduleAllProductNotifications().catch(error => {
        console.error('[NotificationInitializer] Erro ao reagendar notificações após produtos alterados:', error);
      });
    }
  }, [products, settings.enabled, isInitializing]);

  // Não renderizamos nada visível
  return null;
} 