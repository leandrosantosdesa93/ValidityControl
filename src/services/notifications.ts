import * as Notifications from 'expo-notifications';
import { NotificationTriggerInput, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { useProductStore } from '../store/productStore';
import { differenceInDays, format, isWithinInterval, set } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Product } from '../types/Product';

// Configurar sons diferentes para cada nível de urgência
const NOTIFICATION_SOUNDS = {
  urgent: require('@/assets/sounds/urgent.wav'),
  warning: require('@/assets/sounds/warning.wav'),
  info: require('@/assets/sounds/info.wav'),
};

export async function setupNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    // Canais adicionais para diferentes níveis de urgência
    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Urgente',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#FF0000',
      sound: 'urgent.wav',
    });

    await Notifications.setNotificationChannelAsync('warning', {
      name: 'Aviso',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFA500',
      sound: 'warning.wav',
    });

    await Notifications.setNotificationChannelAsync('info', {
      name: 'Informação',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#FFD700',
      sound: 'info.wav',
    });
  }

  return true;
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
  if (daysToExpiry <= 1) return NOTIFICATION_SOUNDS.urgent;
  if (daysToExpiry <= 3) return NOTIFICATION_SOUNDS.warning;
  return NOTIFICATION_SOUNDS.info;
}

export async function scheduleProductNotifications(productId: string) {
  const store = useProductStore.getState();
  const product = store.products.find(p => p.code === productId);
  const settings = store.notificationSettings;

  if (!product || !settings.enabled || !settings.productNotifications[productId]) {
    return;
  }

  // Cancelar notificações existentes para este produto
  await cancelProductNotifications(productId);

  const today = new Date();
  const daysToExpiry = differenceInDays(product.expirationDate, today);

  // Agendar notificações para os dias configurados
  for (const days of settings.notificationDays) {
    if (daysToExpiry >= days) {
      const trigger = new Date(product.expirationDate);
      trigger.setDate(trigger.getDate() - days);
      trigger.setHours(8, 0, 0); // Padrão: 8h da manhã

      // Ajustar horário se estiver no período silencioso
      if (settings.quietHours && isWithinQuietHours(trigger, settings.quietHoursStart, settings.quietHoursEnd)) {
        trigger.setHours(settings.quietHoursEnd, 0, 0);
      }

      const channel = getNotificationChannel(days);
      
      const notificationTrigger: NotificationTriggerInput = {
        type: SchedulableTriggerInputTypes.DATE,
        date: trigger
      };
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Produto ${days <= 1 ? 'URGENTE' : ''} próximo ao vencimento`,
          body: `Atenção: ${product.description} vence em ${days} dias! Código: ${product.code}`,
          sound: settings.soundEnabled ? getNotificationSound(days) : null,
          data: { productId, days }
        },
        trigger: notificationTrigger
      });
    }
  }

  // Notificação no dia do vencimento
  if (daysToExpiry >= 0) {
    const trigger = new Date(product.expirationDate);
    trigger.setHours(8, 0, 0);

    if (settings.quietHours && isWithinQuietHours(trigger, settings.quietHoursStart, settings.quietHoursEnd)) {
      trigger.setHours(settings.quietHoursEnd, 0, 0);
    }

    const channel = getNotificationChannel(0);

    const notificationTrigger: NotificationTriggerInput = {
      type: SchedulableTriggerInputTypes.DATE,
      date: trigger
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'PRODUTO VENCENDO HOJE!',
        body: `URGENTE: ${product.description} vence hoje! Código: ${product.code}`,
        sound: settings.soundEnabled ? NOTIFICATION_SOUNDS.urgent : null,
        data: { productId, days: 0 }
      },
      trigger: notificationTrigger
    });
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
          sound: settings.soundEnabled ? getNotificationSound(daysNum) : null,
          data: { isGroup: true, days: daysNum }
        },
        trigger: notificationTrigger
      });
    }
  }
} 