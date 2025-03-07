import * as Notifications from 'expo-notifications';
import { NotificationTriggerInput, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { useProductStore } from '../store/productStore';
import { differenceInDays, format, isWithinInterval, set } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Product } from '../types/Product';

// Configurar sons diferentes para cada nível de urgência
const NOTIFICATION_SOUNDS = {
  urgent: null,
  warning: null,
  info: null,
};

export async function setupNotifications() {
  try {
    console.log('[NotificationService] Configurando permissões de notificação...');
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[NotificationService] Status atual de permissões:', existingStatus);
    
    let finalStatus = existingStatus;
    
    // Solicitar permissões apenas se não foram concedidas
    if (existingStatus !== 'granted') {
      console.log('[NotificationService] Solicitando permissões...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[NotificationService] Novo status de permissões:', status);
    }
    
    if (finalStatus !== 'granted') {
      console.warn('[NotificationService] Permissões de notificação não concedidas!');
      return false;
    }

    // Configurar canais de notificação para Android
    if (Platform.OS === 'android') {
      console.log('[NotificationService] Configurando canais de notificação para Android...');
      
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Padrão',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00A1DF',
      });

      await Notifications.setNotificationChannelAsync('urgent', {
        name: 'Urgente',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FF0000',
      });

      await Notifications.setNotificationChannelAsync('warning', {
        name: 'Aviso',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFA500',
      });

      await Notifications.setNotificationChannelAsync('info', {
        name: 'Informação',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#FFD700',
      });
      
      console.log('[NotificationService] Canais de notificação configurados com sucesso');
    }
    
    // Configurar handler de notificações
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    
    console.log('[NotificationService] Notificações configuradas com sucesso!');
    
    // Agendar notificações iniciais para todos os produtos
    const store = useProductStore.getState();
    const settings = store.notificationSettings;
    
    if (settings.enabled) {
      console.log('[NotificationService] Agendando notificações iniciais para produtos...');
      
      // Processar cada produto que tem notificações habilitadas
      for (const product of store.products) {
        if (settings.productNotifications[product.code]) {
          await scheduleProductNotifications(product.code);
        }
      }
      
      // Agendar notificações de grupo se habilitadas
      if (settings.groupNotifications) {
        await scheduleGroupNotifications();
      }
    } else {
      console.log('[NotificationService] Notificações desativadas nas configurações. Pulando agendamento inicial.');
    }
    
    return true;
  } catch (error) {
    console.error('[NotificationService] Erro ao configurar notificações:', error);
    return false;
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
  if (daysToExpiry <= 1) return 'urgent';
  if (daysToExpiry <= 3) return 'warning';
  return 'info';
}

function getNotificationSound(daysToExpiry: number) {
  return undefined; // Não usar sons personalizados
}

export async function scheduleProductNotifications(productId: string) {
  try {
    console.log('[NotificationService] Agendando notificações para produto:', productId);
    
    const store = useProductStore.getState();
    const product = store.products.find(p => p.code === productId);
    const settings = store.notificationSettings;

    if (!product) {
      console.warn('[NotificationService] Produto não encontrado:', productId);
      return;
    }
    
    if (!settings.enabled) {
      console.log('[NotificationService] Notificações desativadas nas configurações');
      return;
    }
    
    if (!settings.productNotifications[productId]) {
      console.log('[NotificationService] Notificações desativadas para este produto');
      return;
    }

    // Cancelar notificações existentes para este produto
    await cancelProductNotifications(productId);

    const today = new Date();
    // Garantir que a data de expiração seja um objeto Date válido
    const expirationDate = typeof product.expirationDate === 'string' 
      ? new Date(product.expirationDate) 
      : product.expirationDate;
      
    console.log('[NotificationService] Data de expiração do produto:', expirationDate);
    
    const daysToExpiry = differenceInDays(expirationDate, today);
    console.log('[NotificationService] Dias até expirar:', daysToExpiry);

    // Agendar notificações para os dias configurados
    for (const days of settings.notificationDays) {
      if (daysToExpiry >= days) {
        const trigger = new Date();
        trigger.setDate(trigger.getDate() + (daysToExpiry - days));
        trigger.setHours(9, 0, 0); // 9h da manhã para garantir que funcione
        
        console.log(`[NotificationService] Agendando notificação para ${days} dias antes: ${trigger.toISOString()}`);

        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Produto ${days <= 1 ? 'URGENTE' : ''} próximo ao vencimento`,
              body: `Atenção: ${product.description} vence em ${days} dias! Código: ${product.code}`,
              data: { productId, days }
            },
            trigger: {
              type: SchedulableTriggerInputTypes.DATE,
              date: trigger
            },
          });
          console.log(`[NotificationService] Notificação agendada com sucesso para ${days} dias antes`);
        } catch (error) {
          console.error(`[NotificationService] Erro ao agendar notificação para ${days} dias:`, error);
        }
      }
    }

    // Notificação no dia do vencimento
    if (daysToExpiry >= 0) {
      const trigger = new Date();
      trigger.setDate(trigger.getDate() + daysToExpiry);
      trigger.setHours(9, 0, 0);

      console.log(`[NotificationService] Agendando notificação para o dia do vencimento: ${trigger.toISOString()}`);
      
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'PRODUTO VENCENDO HOJE!',
            body: `URGENTE: ${product.description} vence hoje! Código: ${product.code}`,
            data: { productId, days: 0 }
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: trigger
          },
        });
        console.log('[NotificationService] Notificação do dia do vencimento agendada com sucesso');
      } catch (error) {
        console.error('[NotificationService] Erro ao agendar notificação do dia do vencimento:', error);
      }
    }
    
    // Verificar se as notificações foram agendadas corretamente
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationService] Total de notificações agendadas: ${scheduled.length}`);
    
  } catch (error) {
    console.error('[NotificationService] Erro ao agendar notificações:', error);
  }
}

export async function cancelProductNotifications(productId: string) {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const productNotifications = scheduledNotifications.filter(
    notification => notification.content.data?.productId === productId
  );

  for (const notification of productNotifications) {
    await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  }
}

export async function scheduleGroupNotifications() {
  const store = useProductStore.getState();
  const settings = store.notificationSettings;

  if (!settings.enabled || !settings.groupNotifications) {
    return;
  }

  // Agrupar produtos por dia de vencimento
  const productsByDay = store.products.reduce((acc, product) => {
    const daysToExpiry = differenceInDays(product.expirationDate, new Date());
    if (settings.notificationDays.includes(daysToExpiry)) {
      if (!acc[daysToExpiry]) {
        acc[daysToExpiry] = [];
      }
      acc[daysToExpiry].push(product);
    }
    return acc;
  }, {} as Record<number, Product[]>);

  // Agendar notificações agrupadas
  for (const [days, products] of Object.entries(productsByDay)) {
    if ((products as Product[]).length > 1) {
      const daysNum = parseInt(days);
      const trigger = new Date();
      trigger.setDate(trigger.getDate() + daysNum);
      trigger.setHours(8, 0, 0);

      if (settings.quietHours && isWithinQuietHours(trigger, settings.quietHoursStart, settings.quietHoursEnd)) {
        trigger.setHours(settings.quietHoursEnd, 0, 0);
      }

      const channel = getNotificationChannel(daysNum);
      const productsArray = products as Product[];

      const notificationTrigger: NotificationTriggerInput = {
        type: SchedulableTriggerInputTypes.DATE,
        date: trigger
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${productsArray.length} produtos próximos ao vencimento`,
          body: `Você tem ${productsArray.length} produtos que vencem em ${days} dias`,
          sound: settings.soundEnabled ? getNotificationSound(daysNum) : undefined,
          data: { isGroup: true, days: daysNum }
        },
        trigger: notificationTrigger
      });
    }
  }
} 