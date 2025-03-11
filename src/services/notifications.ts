import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform, Alert, Linking } from 'react-native';
import { useProductStore } from '../store/productStore';
import { differenceInDays } from 'date-fns';
import { Product } from '../types/Product';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Chave para controle de inicialização
const NOTIFICATIONS_INITIALIZED_KEY = '@ValidityControl:notificationsInitialized';

// Configuração básica de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX
  }),
});

/**
 * Verifica e solicita permissões de notificação
 * @returns {Promise<boolean>} Se as permissões foram concedidas
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    console.log('[NotificationService] Solicitando permissões de notificação...');
    
    // Para Android 13 (API level 33) ou superior, POST_NOTIFICATIONS é obrigatório
    if (Platform.OS === 'android') {
      console.log('[NotificationService] Detectado Android, solicitando permissão para notificações');
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('[NotificationService] Status atual de permissões:', existingStatus);
      
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('[NotificationService] Novo status de permissões:', status);
      }
      
      if (finalStatus !== 'granted') {
        console.log('[NotificationService] Permissão não concedida, mostrando alerta');
        Alert.alert(
          'Permissão de Notificações',
          'Para receber alertas sobre produtos a vencer, você precisa permitir notificações nas configurações.',
          [
            { text: 'Depois', style: 'cancel' },
            { 
              text: 'Configurações', 
              onPress: () => Linking.openSettings()
            }
          ]
        );
        return false;
      }
      return true;
    } else {
      // iOS
      const { status } = await Notifications.requestPermissionsAsync();
      console.log('[NotificationService] Status de permissões em iOS:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          'Permissão de Notificações',
          'Para receber alertas sobre produtos a vencer, você precisa permitir notificações.'
        );
        return false;
      }
      return true;
    }
  } catch (error) {
    console.error('[NotificationService] Erro ao solicitar permissões:', error);
    return false;
  }
}

/**
 * Configura os canais de notificação para Android
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  
  try {
    console.log('[NotificationService] Configurando canais para Android...');
    
    // Canal padrão
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificações Gerais',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00A1DF',
    });
    
    // Canal para produtos prestes a vencer
    await Notifications.setNotificationChannelAsync('expiring_products', {
      name: 'Produtos a Vencer',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFA500',
    });
    
    // Canal para produtos vencidos
    await Notifications.setNotificationChannelAsync('expired_products', {
      name: 'Produtos Vencidos',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#FF0000',
    });
    
    // Canal urgente
    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Alertas Urgentes',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: '#FF0000',
    });
    
    // Listar canais para debug
    const channels = await Notifications.getNotificationChannelsAsync();
    console.log('[NotificationService] Canais configurados:', channels.map(c => c.name));
  } catch (error) {
    console.error('[NotificationService] Erro ao configurar canais:', error);
  }
}

/**
 * Inicializa o sistema de notificações completo
 */
export async function initializeNotifications(): Promise<boolean> {
  try {
    console.log('[NotificationService] Iniciando setup de notificações...');
    
    // Verificar se já foi inicializado recentemente
    const lastInitialized = await AsyncStorage.getItem(NOTIFICATIONS_INITIALIZED_KEY);
    const now = Date.now();
    
    if (lastInitialized && (now - parseInt(lastInitialized)) < 3600000) { // 1 hora
      console.log('[NotificationService] Inicializado recentemente, pulando.');
  return true;
}

    // 1. Solicitar permissões
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('[NotificationService] Permissões não concedidas.');
      return false;
    }
    
    // 2. Configurar canais para Android
    await setupNotificationChannels();
    
    // 3. Cancelar notificações existentes para evitar duplicatas
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[NotificationService] Notificações anteriores canceladas.');
    
    // 4. Agendar notificações para produtos
    await scheduleAllProductNotifications();
    
    // Registrar que foi inicializado
    await AsyncStorage.setItem(NOTIFICATIONS_INITIALIZED_KEY, now.toString());
    console.log('[NotificationService] Inicialização completa com sucesso!');
    
    return true;
  } catch (error) {
    console.error('[NotificationService] Erro na inicialização:', error);
    return false;
  }
}

/**
 * Agenda notificações para todos os produtos
 */
export async function scheduleAllProductNotifications(): Promise<void> {
  try {
    const store = useProductStore.getState();
    const settings = store.notificationSettings || {
      enabled: true,
      notificationDays: [1, 3, 5, 7]
    };
    
    if (!settings.enabled) {
      console.log('[NotificationService] Notificações desativadas nas configurações.');
      return;
    }
    
    const products = store.products.filter(p => !p.isSold);
    console.log(`[NotificationService] Agendando notificações para ${products.length} produtos...`);
    
    let scheduledCount = 0;
    
    for (const product of products) {
      try {
        await scheduleProductNotifications(product);
        scheduledCount++;
      } catch (error) {
        console.error(`[NotificationService] Erro ao agendar para ${product.code}:`, error);
      }
    }
    
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationService] Total de ${scheduled.length} notificações agendadas para ${scheduledCount} produtos.`);
  } catch (error) {
    console.error('[NotificationService] Erro ao agendar notificações:', error);
  }
}

/**
 * Verifica e agenda múltiplas notificações para um produto em específico
 */
export async function scheduleProductNotifications(product: Product): Promise<void> {
  try {
    if (product.isSold) {
      console.log(`[NotificationService] Produto ${product.code} marcado como vendido, ignorando.`);
      return;
    }
    
    const store = useProductStore.getState();
    const settings = store.notificationSettings || {
      enabled: true,
      notificationDays: [1, 3, 5, 7]
    };
    
    if (!settings.enabled) {
      console.log(`[NotificationService] Notificações desativadas, ignorando produto ${product.code}.`);
      return;
    }
    
    // Verifica permissões antes de agendar
    const hasPermission = await Notifications.getPermissionsAsync();
    if (hasPermission.status !== 'granted') {
      console.warn(`[NotificationService] Sem permissão para agendar notificações para ${product.code}.`);
      return;
    }
    
    // Calcular dias até o vencimento
    const today = new Date();
    const expirationDate = new Date(product.expirationDate);
    const daysRemaining = differenceInDays(expirationDate, today);
    
    // Se já venceu, podemos agendar apenas uma notificação de vencido
    if (daysRemaining < 0) {
      if (Platform.OS === 'android') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Produto Vencido!',
            body: `${product.description} venceu há ${Math.abs(daysRemaining)} dias!`,
            data: { productId: product.code, screen: 'expired' },
            sound: true,
            channelId: 'expired_products',
          },
          trigger: { seconds: 10 + Math.floor(Math.random() * 60) },
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Produto Vencido!',
            body: `${product.description} venceu há ${Math.abs(daysRemaining)} dias!`,
            data: { productId: product.code, screen: 'expired' },
            sound: true,
          },
          trigger: { seconds: 10 + Math.floor(Math.random() * 60) },
        });
      }
      console.log(`[NotificationService] Agendada notificação para produto vencido ${product.code}`);
      return;
    }
    
    // Verificar quais dias devem gerar notificação
    const notificationDays = settings.notificationDays.filter(days => days <= daysRemaining);
    
    if (notificationDays.length === 0) {
      console.log(`[NotificationService] Nenhum dia configurado para ${product.code} (faltam ${daysRemaining} dias)`);
      return;
    }
    
    console.log(`[NotificationService] Agendando ${notificationDays.length} notificações para ${product.code}`);
    
    for (const days of notificationDays) {
      // Calcular quando a notificação deve aparecer
      const notificationDate = new Date(expirationDate);
      notificationDate.setDate(notificationDate.getDate() - days);
      
      // Se a data já passou, pular
      if (notificationDate <= today) {
        console.log(`[NotificationService] Data de ${days} dias já passou para ${product.code}, pulando`);
        continue;
      }
      
      // Preparar conteúdo da notificação
      let title, body, channelId;
      
      if (days <= 3) {
        title = `URGENTE: ${product.description} vai vencer!`;
        body = `Faltam apenas ${days} dia${days > 1 ? 's' : ''} para ${product.description} vencer!`;
        channelId = 'urgent';
      } else {
        title = `${product.description} vai vencer em breve`;
        body = `Faltam ${days} dias para o vencimento.`;
        channelId = 'expiring_products';
      }
      
      try {
        // Definir trigger para a data calculada
        const trigger: SchedulableTriggerInputTypes = {
          hour: 9, // Notificar às 9h
          minute: 0,
          repeats: false,
          // Data da notificação
          day: notificationDate.getDate(),
          month: notificationDate.getMonth() + 1, // Mês em JS é 0-indexed
        };
        
        if (Platform.OS === 'android') {
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data: { productId: product.code, days, screen: 'expiring' },
              sound: true,
              channelId,
            },
            trigger,
          });
        } else {
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data: { productId: product.code, days, screen: 'expiring' },
              sound: true,
            },
            trigger,
          });
        }
        
        console.log(`[NotificationService] Agendado alerta de ${days} dias para ${product.code}`);
      } catch (error) {
        console.error(`[NotificationService] Erro ao agendar notificação para ${product.code}:`, error);
      }
    }
  } catch (error) {
    console.error(`[NotificationService] Erro processando ${product.code}:`, error);
  }
}

/**
 * Agenda 4 notificações repetidas a cada 3 horas para produtos vencendo hoje
 */
export async function scheduleRepeatedNotifications(product: Product): Promise<void> {
  try {
    const baseHours = [9, 12, 15, 18]; // 9h, 12h, 15h e 18h
    const now = new Date();
    const currentHour = now.getHours();
    
    console.log(`[NotificationService] Agendando alertas repetidos para produto ${product.code} vencendo hoje.`);
    
    for (let i = 0; i < baseHours.length; i++) {
      // Apenas agendar horários futuros
      if (baseHours[i] <= currentHour) {
        continue;
      }
      
      const notificationTime = new Date();
      notificationTime.setHours(baseHours[i], 0, 0, 0);
      
      // Se o horário for passado, ajustar para 5 minutos no futuro
      if (notificationTime <= now) {
        notificationTime.setTime(now.getTime() + (5 + i * 3) * 60000);
      }
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `URGENTE: ${product.description} VENCE HOJE!`,
          body: `${i > 0 ? '[ALERTA REPETIDO] ' : ''}Produto com código ${product.code} vence hoje! Verifique imediatamente.`,
          data: { 
            productId: product.code, 
            days: 0, 
            repeatIndex: i 
          },
          color: '#FF0000',
          sound: true,
          vibrate: [0, 500, 250, 500],
          priority: 'max' as any,
          badge: i + 1,
          ...(Platform.OS === 'android' && { channelId: 'urgent' })
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: notificationTime
        },
      });
      
      console.log(`[NotificationService] Agendado alerta #${i+1} para hoje às ${baseHours[i]}h (${notificationTime.toISOString()})`);
    }
  } catch (error) {
    console.error(`[NotificationService] Erro ao agendar alertas repetidos para ${product.code}:`, error);
  }
}

/**
 * Cancela todas as notificações agendadas para um produto específico
 */
export async function cancelProductNotifications(productCode: string): Promise<void> {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    let cancelCount = 0;
    
    for (const notification of scheduledNotifications) {
      const data = notification.content.data as any;
      if (data?.productId === productCode) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        cancelCount++;
      }
    }
    
    if (cancelCount > 0) {
      console.log(`[NotificationService] Canceladas ${cancelCount} notificações do produto ${productCode}`);
    }
  } catch (error) {
    console.error(`[NotificationService] Erro ao cancelar notificações do produto ${productCode}:`, error);
  }
}

/**
 * Recarrega e agenda novamente todas as notificações
 */
export async function refreshAllNotifications(): Promise<boolean> {
  try {
    console.log('[NotificationService] Recarregando todas as notificações...');
    
    await Notifications.cancelAllScheduledNotificationsAsync();
    await scheduleAllProductNotifications();
    
    console.log('[NotificationService] Notificações recarregadas com sucesso.');
    return true;
  } catch (error) {
    console.error('[NotificationService] Erro ao recarregar notificações:', error);
    return false;
  }
}

/**
 * Mostra uma notificação de teste para verificar se o sistema de notificações está funcionando
 */
export async function showTestNotification(): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('[NotificationService] Permissões não concedidas para teste de notificação.');
      return;
    }
    
    if (Platform.OS === 'android') {
      await setupNotificationChannels();
    }
    
    console.log('[NotificationService] Enviando notificação de teste...');
    
    const notificationContent = {
      title: 'Teste de Notificação',
      body: 'Se você está vendo isso, as notificações estão funcionando! 👍',
      data: { screen: 'test' },
      sound: true,
    };
    
    // No Android, especificamos o canal
    if (Platform.OS === 'android') {
      await Notifications.scheduleNotificationAsync({
        content: {
          ...notificationContent,
          channelId: 'default',
        },
        trigger: null, // mostra imediatamente
      });
    } else {
      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // mostra imediatamente
      });
    }
    
    console.log('[NotificationService] Notificação de teste enviada com sucesso!');
  } catch (error) {
    console.error('[NotificationService] Erro ao enviar notificação de teste:', error);
    Alert.alert(
      'Erro ao Testar Notificações',
      'Não foi possível enviar uma notificação de teste. Verifique as permissões do aplicativo.'
    );
  }
}

function isWithinQuietHours(date: Date, start: number, end: number): boolean {
  const hour = date.getHours();
  if (start <= end) {
    return hour >= start && hour < end;
  } else {
    // Para casos onde o período atravessa a meia-noite (ex: 22h às 7h)
    return hour >= start || hour < end;
  }
}

function getNotificationChannel(daysToExpiry: number): string {
  return daysToExpiry <= 1 ? 'urgent' : 'expiring_products';
}

export async function scheduleGroupNotifications() {
  const store = useProductStore.getState();
  const settings = store.notificationSettings;

  if (!settings.enabled || !settings.groupNotifications) {
    console.log('[NotificationService] Notificações de grupo desativadas. Pulando agendamento.');
    return;
  }

  console.log('[NotificationService] Iniciando agendamento de notificações de grupo');

  // Filtrar produtos não vendidos
  const activeProducts = store.products.filter(product => !product.isSold);
  console.log(`[NotificationService] Total de produtos ativos: ${activeProducts.length} de ${store.products.length}`);

  // Agrupar produtos por dia de vencimento
  const productsByDay = activeProducts.reduce((acc, product) => {
    const daysToExpiry = differenceInDays(
      typeof product.expirationDate === 'string' 
        ? new Date(product.expirationDate) 
        : product.expirationDate, 
      new Date()
    );
    
    if (settings.notificationDays.includes(daysToExpiry)) {
      if (!acc[daysToExpiry]) {
        acc[daysToExpiry] = [];
      }
      acc[daysToExpiry].push(product);
    }
    return acc;
  }, {} as Record<number, Product[]>);

  console.log('[NotificationService] Produtos agrupados por dias de vencimento:', 
    Object.keys(productsByDay).map(day => ({ 
      dias: day, 
      quantidade: productsByDay[parseInt(day)].length 
    }))
  );

  // Agendar notificações agrupadas
  for (const [days, products] of Object.entries(productsByDay)) {
    if ((products as Product[]).length > 1) {
      const daysNum = parseInt(days);
      const notificationDate = new Date();
      notificationDate.setDate(notificationDate.getDate() + daysNum);
      notificationDate.setHours(8, 0, 0, 0);

      // Verificar se estamos tentando agendar para o passado
      if (notificationDate <= new Date()) {
        console.log(`[NotificationService] Data da notificação de grupo ${notificationDate.toISOString()} é no passado, ajustando...`);
        
        // Se for para hoje, agendar para 10 minutos no futuro
        const futureDate = new Date();
        futureDate.setMinutes(futureDate.getMinutes() + 10);
        notificationDate.setTime(futureDate.getTime());
        
        console.log(`[NotificationService] Nova data ajustada: ${notificationDate.toISOString()}`);
      }

      if (settings.quietHours && isWithinQuietHours(notificationDate, settings.quietHoursStart, settings.quietHoursEnd)) {
        notificationDate.setHours(settings.quietHoursEnd, 0, 0, 0);
        console.log(`[NotificationService] Notificação agendada para após o modo silencioso: ${notificationDate.toISOString()}`);
      }

      const channel = getNotificationChannel(daysNum);
      const productsArray = products as Product[];

      console.log(`[NotificationService] Agendando notificação de grupo para ${productsArray.length} produtos que vencem em ${days} dias`);

      try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${productsArray.length} produtos próximos ao vencimento`,
          body: `Você tem ${productsArray.length} produtos que vencem em ${days} dias`,
            sound: settings.soundEnabled,
            data: { isGroup: true, days: daysNum },
            color: daysNum <= 1 ? '#FF0000' : '#FFA500',
            vibrate: daysNum <= 1 ? [0, 500, 250, 500] : [0, 250, 250, 250],
            priority: daysNum <= 1 ? 'max' : 'high',
            ...(Platform.OS === 'android' && { channelId: channel })
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: notificationDate
          }
        });
        console.log(`[NotificationService] Notificação de grupo agendada com sucesso para ${days} dias`);
      } catch (error) {
        console.error(`[NotificationService] Erro ao agendar notificação de grupo:`, error);
      }
    }
  }
  
  // Verificar notificações agendadas
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  console.log(`[NotificationService] Total de notificações de grupo agendadas: ${scheduled.length}`);
} 