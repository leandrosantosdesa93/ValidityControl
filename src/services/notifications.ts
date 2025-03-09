import * as Notifications from 'expo-notifications';
import { NotificationTriggerInput, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { useProductStore } from '../store/productStore';
import { differenceInDays, format, isWithinInterval, set } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Product } from '../types/Product';

// Configurar sons diferentes para cada nível de urgência
const NOTIFICATION_SOUNDS = {
  urgent: null, // Usar o som padrão do sistema
  warning: null, // Usar o som padrão do sistema
  info: null, // Usar o som padrão do sistema
};

export async function setupNotifications() {
  try {
    console.log('[NotificationService] Configurando permissões de notificação...');
    console.log('[NotificationService] Plataforma:', Platform.OS, Platform.Version);
    
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
      
      try {
        await Notifications.deleteNotificationChannelAsync('default');
        console.log('[NotificationService] Canal padrão resetado');
      } catch (e) {
        console.log('[NotificationService] Erro ao resetar canal padrão:', e);
      }
      
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Padrão',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00A1DF',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('urgent', {
        name: 'Urgente',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FF0000',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('warning', {
        name: 'Aviso',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFA500',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('info', {
        name: 'Informação',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#FFD700',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });
      
      console.log('[NotificationService] Canais de notificação configurados com sucesso');
      
      // Lista todos os canais para debug
      const channels = await Notifications.getNotificationChannelsAsync();
      console.log('[NotificationService] Canais configurados:', 
        channels.map(c => ({ id: c.id, name: c.name, importance: c.importance })));
    }
    
    // Configurar handler de notificações
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        console.log('[NotificationService] Processando notificação recebida');
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority: Notifications.AndroidNotificationPriority.MAX
        };
      },
    });
    
    console.log('[NotificationService] Handler de notificações configurado com sucesso');
    
    // Limpar notificações antigas agendadas antes de criar novas
    const oldNotifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationService] Encontradas ${oldNotifications.length} notificações agendadas anteriormente`);
    
    if (oldNotifications.length > 0) {
      console.log('[NotificationService] Cancelando notificações antigas...');
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[NotificationService] Notificações antigas canceladas com sucesso');
    }
    
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
      
      // Verificar notificações agendadas
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      console.log(`[NotificationService] Total de ${scheduled.length} notificações agendadas com sucesso`);
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
    
    // Verificar se o produto já foi marcado como vendido
    if (product.isSold) {
      console.log('[NotificationService] Produto já foi marcado como vendido. Pulando notificações:', productId);
      // Cancelar qualquer notificação existente
      await cancelProductNotifications(productId);
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
        const notificationDate = new Date();
        notificationDate.setDate(notificationDate.getDate() + (daysToExpiry - days));
        notificationDate.setHours(9, 0, 0, 0); // 9h da manhã para garantir que funcione
        
        console.log(`[NotificationService] Agendando notificação para ${days} dias antes: ${notificationDate.toISOString()}`);

        // Verificar se estamos tentando agendar para o passado
        if (notificationDate <= new Date()) {
          console.log(`[NotificationService] Data da notificação ${notificationDate.toISOString()} é no passado, ajustando...`);
          
          // Se for para hoje, agendar para 5 minutos no futuro
          const futureDate = new Date();
          futureDate.setMinutes(futureDate.getMinutes() + 5);
          notificationDate.setTime(futureDate.getTime());
          
          console.log(`[NotificationService] Nova data ajustada: ${notificationDate.toISOString()}`);
        }

        const channel = getNotificationChannel(days);
        
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Produto ${days <= 1 ? 'URGENTE' : ''} próximo ao vencimento`,
              body: `Atenção: ${product.description} vence em ${days} dias! Código: ${product.code}`,
              data: { productId, days },
              color: days <= 1 ? '#FF0000' : '#FFA500',
              sound: true,
              vibrate: [0, 250, 250, 250],
              priority: days <= 1 ? 'max' : 'high',
              ...(Platform.OS === 'android' && { channelId: channel })
            },
            trigger: {
              type: SchedulableTriggerInputTypes.DATE,
              date: notificationDate
            },
          });
          console.log(`[NotificationService] Notificação agendada com sucesso para ${days} dias antes`);
        } catch (error) {
          console.error(`[NotificationService] Erro ao agendar notificação para ${days} dias:`, error);
        }
      }
    }

    // Notificação no dia do vencimento (múltiplas notificações com intervalos de 3 horas)
    if (daysToExpiry >= 0 && daysToExpiry < 1) {
      console.log(`[NotificationService] Agendando múltiplas notificações para o dia do vencimento`);
      
      // Horários para as notificações (4 notificações com intervalo de 3 horas)
      const notificationHours = [9, 12, 15, 18]; // 9h, 12h, 15h e 18h
      
      for (let i = 0; i < notificationHours.length; i++) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + daysToExpiry);
        expiryDate.setHours(notificationHours[i], 0, 0, 0);

        console.log(`[NotificationService] Agendando notificação #${i+1} para o dia do vencimento: ${expiryDate.toISOString()}`);
        
        // Verificar se estamos tentando agendar para o passado
        if (expiryDate <= new Date()) {
          console.log(`[NotificationService] Data da notificação ${expiryDate.toISOString()} é no passado, ajustando...`);
          
          // Verificar se ainda há horários válidos restantes
          const currentHour = new Date().getHours();
          let nextValidHour = null;
          
          // Encontrar o próximo horário válido
          for (const hour of notificationHours) {
            if (hour > currentHour) {
              nextValidHour = hour;
              break;
            }
          }
          
          if (nextValidHour !== null) {
            // Ajustar para o próximo horário válido
            expiryDate.setHours(nextValidHour, 0, 0, 0);
            console.log(`[NotificationService] Ajustado para próximo horário válido: ${expiryDate.toISOString()}`);
          } else {
            // Se não houver horário válido restante hoje, agendar para 5 minutos no futuro
            const futureDate = new Date();
            futureDate.setMinutes(futureDate.getMinutes() + 5 + (i * 3));
            expiryDate.setTime(futureDate.getTime());
            console.log(`[NotificationService] Ajustado para 5+ minutos no futuro: ${expiryDate.toISOString()}`);
          }
        }
        
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'PRODUTO VENCENDO HOJE!',
              body: `URGENTE: ${product.description} vence hoje! ${i > 0 ? 'ALERTA REPETIDO' : ''} Código: ${product.code}`,
              data: { 
                productId, 
                days: 0, 
                alertCount: i + 1, 
                totalAlerts: notificationHours.length,
                isExpiryDayAlert: true 
              },
              color: '#FF0000',
              sound: true,
              vibrate: [0, 500, 250, 500],
              priority: 'max',
              badge: i + 1,
              ...(Platform.OS === 'android' && { channelId: 'urgent' })
            },
            trigger: {
              type: SchedulableTriggerInputTypes.DATE,
              date: expiryDate
            },
          });
          console.log(`[NotificationService] Notificação #${i+1} do dia do vencimento agendada com sucesso`);
        } catch (error) {
          console.error(`[NotificationService] Erro ao agendar notificação #${i+1} do dia do vencimento:`, error);
        }
      }
    } else if (daysToExpiry >= 0) {
      // Comportamento original para produtos que não vencem hoje
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + daysToExpiry);
      expiryDate.setHours(9, 0, 0, 0);

      console.log(`[NotificationService] Agendando notificação para o dia do vencimento: ${expiryDate.toISOString()}`);
      
      // Verificar se estamos tentando agendar para o passado
      if (expiryDate <= new Date()) {
        console.log(`[NotificationService] Data da notificação ${expiryDate.toISOString()} é no passado, ajustando...`);
        
        // Se for para hoje, agendar para 5 minutos no futuro
        const futureDate = new Date();
        futureDate.setMinutes(futureDate.getMinutes() + 5);
        expiryDate.setTime(futureDate.getTime());
        
        console.log(`[NotificationService] Nova data ajustada: ${expiryDate.toISOString()}`);
      }
      
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'PRODUTO VENCENDO HOJE!',
            body: `URGENTE: ${product.description} vence hoje! Código: ${product.code}`,
            data: { productId, days: 0 },
            color: '#FF0000',
            sound: true,
            vibrate: [0, 500, 250, 500],
            priority: 'max',
            ...(Platform.OS === 'android' && { channelId: 'urgent' })
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: expiryDate
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