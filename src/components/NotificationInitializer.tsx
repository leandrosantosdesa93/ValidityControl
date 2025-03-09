import React, { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { setupNotifications, scheduleProductNotifications, scheduleGroupNotifications } from '../services/notifications';
import { useProductStore } from '../store/productStore';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { getProducts } from '@/services/ProductService';

export function NotificationInitializer() {
  // Inicializar o sistema de atualização automática
  useAutoUpdate();
  
  // Acesso ao store
  const store = useProductStore();
  const notificationSettings = store.notificationSettings;

  // Função para solicitar permissões de notificação
  const requestNotificationPermissions = async () => {
    if (Platform.OS === 'android') {
      // Android 13 (API 33) ou superior requer permissão específica para notificações
      if (parseInt(Platform.Version as string, 10) >= 33) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        
        console.log('[NotificationInitializer] Status atual de permissões Android 13+:', existingStatus);
        
        if (existingStatus !== 'granted') {
          console.log('[NotificationInitializer] Solicitando permissões Android 13+...');
          const { status } = await Notifications.requestPermissionsAsync();
          
          if (status !== 'granted') {
            // Mostrar alerta explicando a importância das notificações
            Alert.alert(
              'Permissão Necessária',
              'Para receber alertas sobre produtos prestes a vencer, é necessário permitir notificações. Você pode habilitar isto nas configurações do aplicativo.',
              [
                { text: 'Mais tarde', style: 'cancel' },
                { 
                  text: 'Configurações', 
                  onPress: () => Notifications.presentPermissionRequestScreen()
                }
              ]
            );
            return false;
          }
        }
      }
    }
    
    // Para iOS ou Android < 13
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[NotificationInitializer] Status atual de permissões:', existingStatus);
    
    if (existingStatus !== 'granted') {
      console.log('[NotificationInitializer] Solicitando permissões...');
      const { status } = await Notifications.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Para receber alertas sobre produtos prestes a vencer, é necessário permitir notificações.'
        );
        return false;
      }
    }
    
    return true;
  };

  // Função para verificar se um produto já foi marcado como vendido
  const checkIfProductIsSold = async (productId: string) => {
    try {
      const products = await getProducts();
      const product = products.find(p => p.code === productId);
      
      // Se o produto não for encontrado ou estiver marcado como vendido
      if (!product || product.isSold === true) {
        console.log(`[NotificationInitializer] Produto ${productId} já foi vendido ou não existe`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[NotificationInitializer] Erro ao verificar status do produto:', error);
      return false;
    }
  };

  useEffect(() => {
    // Garantir que as notificações estejam habilitadas por padrão
    if (!notificationSettings.enabled) {
      console.log('[NotificationInitializer] Habilitando notificações por padrão');
      store.setNotificationsEnabled(true);
    }
    
    // Configurar comportamento de notificações
    if (Platform.OS === 'android') {
      console.log('[NotificationInitializer] Configurando canais de notificação para Android');
      
      Notifications.setNotificationChannelAsync('default', {
        name: 'Geral',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00A1DF',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      
      Notifications.setNotificationChannelAsync('urgent', {
        name: 'Urgente',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FF0000',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      
      Notifications.setNotificationChannelAsync('warning', {
        name: 'Aviso',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFA500',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      
      Notifications.setNotificationChannelAsync('info', {
        name: 'Informação',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#FFD700',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }
    
    // Configurar handler de notificações
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        console.log('[NotificationInitializer] Processando notificação recebida:', notification);
        
        // Verificar se é uma notificação de produto vencendo hoje
        const data = notification.request.content.data as any;
        if (data?.isExpiryDayAlert && data?.productId) {
          // Verificar se o produto já foi marcado como vendido
          const isSold = await checkIfProductIsSold(data.productId);
          
          // Se o produto já foi marcado como vendido, não mostrar a notificação
          if (isSold) {
            console.log(`[NotificationInitializer] Produto ${data.productId} já foi vendido, cancelando notificação`);
            return {
              shouldShowAlert: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            };
          }
        }
        
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      },
    });

    // Inicializar notificações
    const initNotifications = async () => {
      try {
        console.log('[NotificationInitializer] Iniciando configuração de notificações');
        
        // Solicitar permissões
        const permissionGranted = await requestNotificationPermissions();
        if (!permissionGranted) {
          console.log('[NotificationInitializer] Permissões de notificação não concedidas');
          return;
        }
        
        // Configurar e agendar notificações
        const success = await setupNotifications();
        console.log('[NotificationInitializer] Notificações inicializadas:', success);
        
        // Verificar notificações agendadas
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        console.log(`[NotificationInitializer] Notificações agendadas: ${scheduled.length}`);
        
        if (scheduled.length === 0 && store.products.length > 0 && notificationSettings.enabled) {
          console.log('[NotificationInitializer] Nenhuma notificação agendada. Reagendando...');
          
          // Reagendar notificações para todos os produtos
          for (const product of store.products) {
            // Ignorar produtos marcados como vendidos
            if (product.isSold) {
              console.log(`[NotificationInitializer] Ignorando produto já vendido: ${product.code}`);
              continue;
            }
            
            console.log(`[NotificationInitializer] Reagendando notificações para: ${product.code}`);
            await scheduleProductNotifications(product.code);
          }
          
          // Reagendar notificações de grupo
          if (notificationSettings.groupNotifications) {
            await scheduleGroupNotifications();
          }
          
          // Verificar novamente
          const updatedScheduled = await Notifications.getAllScheduledNotificationsAsync();
          console.log(`[NotificationInitializer] Notificações reagendadas: ${updatedScheduled.length}`);
        }
      } catch (error) {
        console.error('[NotificationInitializer] Erro na inicialização:', error);
      }
    };

    initNotifications();

    // Configurar listener para notificações recebidas
    const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('[NotificationInitializer] Notificação recebida:', notification);
    });
    
    // Configurar listener para notificações respondidas
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[NotificationInitializer] Usuário respondeu à notificação:', response);
      
      // Aqui você pode adicionar lógica para navegar para uma tela específica com base na notificação
      // Exemplo: Se a notificação é sobre um produto específico, abrir a tela de detalhes desse produto
    });

    // Limpar quando o componente for desmontado
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return null; // Este componente não renderiza nada visualmente
} 