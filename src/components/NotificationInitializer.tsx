import React, { useEffect, useState } from 'react';
import { Platform, Alert, View, Text, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { useProductStore } from '../store/productStore';
import {
  initializeNotifications,
  refreshAllNotifications,
  cancelProductNotifications
} from '../services/notifications';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from '@hooks/useColorScheme';

// Garantir que o SplashScreen fique visível até terminarmos a inicialização
SplashScreen.preventAutoHideAsync();

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Acesso ao store
  const store = useProductStore();
  const settings = store.notificationSettings;

  // Inicializar o sistema de atualização automática
  useAutoUpdate();

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
        
        // Inicializar com o novo serviço
        const success = await initializeNotifications();
        
        if (success) {
          console.log('[NotificationInitializer] Notificações inicializadas com sucesso');
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
        SplashScreen.hideAsync();
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
    if (!isInitializing && settings.enabled) {
      console.log('[NotificationInitializer] Configurações de notificação alteradas, atualizando...');
      refreshAllNotifications().catch(error => {
        console.error('[NotificationInitializer] Erro ao atualizar notificações:', error);
      });
    }
  }, [settings, isInitializing]);

  // Não renderizamos nada visível
  return null;
} 