import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { setupNotifications, scheduleProductNotifications, scheduleGroupNotifications } from '../services/notifications';
import { useProductStore } from '../store/productStore';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import * as Notifications from 'expo-notifications';

export function NotificationInitializer() {
  // Inicializar o sistema de atualização automática
  useAutoUpdate();
  
  // Acesso ao store
  const store = useProductStore();
  const notificationSettings = store.notificationSettings;

  useEffect(() => {
    // Garantir que as notificações estejam habilitadas por padrão
    if (!notificationSettings.enabled) {
      console.log('[NotificationInitializer] Habilitando notificações por padrão');
      store.setNotificationsEnabled(true);
    }
    
    // Configurar comportamento de notificações
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    
    // Configurar handler de notificações
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Inicializar notificações
    const initNotifications = async () => {
      try {
        console.log('[NotificationInitializer] Iniciando configuração de notificações');
        const success = await setupNotifications();
        console.log('[NotificationInitializer] Notificações inicializadas:', success);
        
        // Verificar notificações agendadas
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        console.log(`[NotificationInitializer] Notificações agendadas: ${scheduled.length}`);
        
        if (scheduled.length === 0 && store.products.length > 0 && notificationSettings.enabled) {
          console.log('[NotificationInitializer] Nenhuma notificação agendada. Reagendando...');
          
          // Reagendar notificações para todos os produtos
          for (const product of store.products) {
            console.log(`[NotificationInitializer] Reagendando notificações para: ${product.code}`);
            await scheduleProductNotifications(product.code);
          }
          
          // Reagendar notificações de grupo
          if (notificationSettings.groupNotifications) {
            await scheduleGroupNotifications();
          }
        }
      } catch (error) {
        console.error('[NotificationInitializer] Erro na inicialização:', error);
      }
    };

    initNotifications();

    // Configurar listener para notificações recebidas
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('[NotificationInitializer] Notificação recebida:', notification);
    });

    // Limpar quando o componente for desmontado
    return () => {
      subscription.remove();
    };
  }, []);

  return null; // Este componente não renderiza nada visualmente
} 