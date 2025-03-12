import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform, Alert, Linking } from 'react-native';
import { useProductStore } from '../store/productStore';
import { differenceInDays } from 'date-fns';
import { Product } from '../types/Product';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import * as Device from 'expo-device';

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
 * Verifica se o horário atual está dentro do período de silêncio
 * @returns {boolean} Se o horário atual está dentro do período de silêncio
 */
function isQuietTime(): boolean {
  const store = useProductStore.getState();
  const { quietHours, quietHoursStart, quietHoursEnd } = store.notificationSettings;

  if (!quietHours) return false;

  const now = dayjs();
  const currentHour = now.hour() + now.minute() / 60;

  // Verificar se estamos no período de silêncio
  if (quietHoursStart < quietHoursEnd) {
    // Período normal (ex: 22:00 às 08:00)
    return currentHour >= quietHoursStart && currentHour < quietHoursEnd;
  } else {
    // Período que passa da meia-noite (ex: 22:00 às 08:00)
    return currentHour >= quietHoursStart || currentHour < quietHoursEnd;
  }
}

/**
 * Solicita permissões de notificação
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
    console.log('[Notifications] Configurando canais para Android...');
    
    // Canal para notificações de expiração
    await Notifications.setNotificationChannelAsync('expiration-alerts', {
      name: 'Alertas de Validade',
      description: 'Notificações sobre produtos prestes a vencer',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: true,
    });
    
    // Canal para notificações de teste
    await Notifications.setNotificationChannelAsync('test-notifications', {
      name: 'Notificações de Teste',
      description: 'Notificações para testar o funcionamento do sistema',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 100, 100],
      lightColor: '#00A1DF',
      sound: true,
    });
    
    // Verificar canais configurados
    const channels = await Notifications.getNotificationChannelsAsync();
    console.log(`[Notifications] ${channels.length} canais configurados`);
    
  } catch (error) {
    console.error('[Notifications] Erro ao configurar canais de notificação:', error);
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
    
    // Verificar permissões antes de agendar
    const { status } = await Notifications.getPermissionsAsync();
    console.log('[NotificationService] Status atual de permissões:', status);
    
    if (status !== 'granted') {
      console.warn('[NotificationService] Sem permissões para notificações, solicitando...');
      const hasPermissions = await requestNotificationPermissions();
      if (!hasPermissions) {
        console.error('[NotificationService] Permissões negadas, não é possível agendar notificações');
        return;
      }
    }
    
    // Para Android, verificar canais de notificação
    if (Platform.OS === 'android') {
      console.log('[NotificationService] Verificando canais de notificação no Android');
      await setupNotificationChannels();
    }
    
    // Filtrar produtos não vendidos
    const products = store.products.filter(p => !p.isSold);
    console.log(`[NotificationService] Agendando notificações para ${products.length} produtos...`);
    
    // Cancelar todas as notificações existentes
    const currentScheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationService] Cancelando ${currentScheduled.length} notificações existentes...`);
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    if (products.length === 0) {
      console.log('[NotificationService] Nenhum produto para agendar notificações.');
      return;
    }
    
    let scheduledCount = 0;
    let errorCount = 0;
    
    // Agendar para cada produto individualmente
    for (const product of products) {
      try {
        await scheduleProductNotifications(product);
        scheduledCount++;
      } catch (error) {
        errorCount++;
        console.error(`[NotificationService] Erro ao agendar para ${product.code}:`, error);
      }
      
      // Pequena pausa para não sobrecarregar a API de notificações
      if (Platform.OS === 'android' && scheduledCount % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationService] Total: ${scheduled.length} notificações agendadas para ${scheduledCount} produtos. Erros: ${errorCount}`);
    
    // Se houver erros mas ainda conseguimos agendar algumas notificações, consideramos sucesso parcial
    if (errorCount > 0 && scheduledCount > 0) {
      console.warn(`[NotificationService] Algumas notificações (${errorCount}) falharam, mas ${scheduledCount} produtos têm notificações agendadas.`);
    } else if (errorCount > 0) {
      console.error('[NotificationService] Falha ao agendar todas as notificações.');
    }
  } catch (error) {
    console.error('[NotificationService] Erro crítico ao agendar notificações:', error);
  }
}

/**
 * Agenda notificações para um produto específico
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
    
    // Cancelar todas as notificações existentes para este produto para evitar duplicatas
    await cancelProductNotifications(product.code);
    console.log(`[NotificationService] Notificações anteriores canceladas para ${product.code}`);
    
    // Calcular dias até o vencimento
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar para início do dia
    
    const expirationDate = new Date(product.expirationDate);
    expirationDate.setHours(0, 0, 0, 0); // Normalizar para início do dia
    
    const daysRemaining = differenceInDays(expirationDate, today);
    console.log(`[NotificationService] Produto ${product.code}: faltam ${daysRemaining} dias para vencer.`);
    
    // Se já venceu, agendar uma notificação de "produto vencido"
    if (daysRemaining < 0) {
      const content = {
        title: 'Produto Vencido!',
        body: `${product.description} venceu há ${Math.abs(daysRemaining)} dias!`,
        data: { productId: product.code, screen: 'expired' },
        sound: true,
      };
      
      // No Android, precisamos incluir o canal
      if (Platform.OS === 'android') {
        await Notifications.scheduleNotificationAsync({
          content: {
            ...content,
            channelId: 'expired_products',
          },
          trigger: { seconds: 10 }, // Mostrar em 10 segundos
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: { seconds: 10 }, // Mostrar em 10 segundos
        });
      }
      
      console.log(`[NotificationService] Agendada notificação para produto já vencido: ${product.code}`);
      return;
    }
    
    // Se vence hoje
    if (daysRemaining === 0) {
      const content = {
        title: 'URGENTE: Produto Vence HOJE!',
        body: `${product.description} vence hoje!`,
        data: { productId: product.code, screen: 'expiring' },
        sound: true,
      };
      
      // Agendar três notificações ao longo do dia
      const hours = [9, 12, 18]; // Horários de notificação: 9h, 12h e 18h
      
      for (const hour of hours) {
        const notifyDate = new Date();
        notifyDate.setHours(hour, 0, 0, 0);
        
        // Se o horário já passou hoje, pular
        if (notifyDate <= new Date()) continue;
        
        if (Platform.OS === 'android') {
          await Notifications.scheduleNotificationAsync({
            content: {
              ...content,
              channelId: 'urgent',
            },
            trigger: { 
              hour,
              minute: 0,
              repeats: false,
            },
          });
        } else {
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: { 
              hour,
              minute: 0,
              repeats: false,
            },
          });
        }
        
        console.log(`[NotificationService] Agendada notificação para hoje às ${hour}h - Produto: ${product.code}`);
      }
      
      return;
    }
    
    // Verificar quais dias devem gerar notificação
    const notificationDays = settings.notificationDays
      .filter(days => days <= daysRemaining)
      .sort((a, b) => b - a); // Ordenar do maior para o menor
    
    if (notificationDays.length === 0) {
      console.log(`[NotificationService] Nenhum dia configurado para ${product.code} (faltam ${daysRemaining} dias)`);
      return;
    }
    
    console.log(`[NotificationService] Agendando ${notificationDays.length} notificações para ${product.code}`);
    
    for (const days of notificationDays) {
      // Calcular a data exata da notificação
      const notificationDate = new Date(today);
      notificationDate.setDate(today.getDate() + (daysRemaining - days));
      notificationDate.setHours(9, 0, 0, 0); // Fixar às 9h da manhã
      
      // Já passou do horário hoje? Se sim, pular
      if (days === daysRemaining && notificationDate < new Date()) {
        console.log(`[NotificationService] Horário já passou hoje para ${product.code}, pulando alerta de ${days} dias`);
        continue;
      }
      
      console.log(`[NotificationService] Preparando alerta para ${days} dias antes (${notificationDate.toISOString()}) - Produto: ${product.code}`);
      
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
        // Para Android, usamos a forma mais simplificada e confiável de trigger
        if (Platform.OS === 'android') {
          // Calcular os segundos até a notificação
          const secondsUntilNotification = Math.floor(
            (notificationDate.getTime() - new Date().getTime()) / 1000
          );
          
          // Só agendar se for no futuro
          if (secondsUntilNotification <= 0) {
            console.log(`[NotificationService] Tempo de notificação no passado para ${product.code}, ignorando`);
            continue;
          }
          
          console.log(`[NotificationService] Agendando para ${secondsUntilNotification} segundos no futuro`);
          
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data: { productId: product.code, days, screen: 'expiring' },
              sound: true,
              channelId,
            },
            trigger: { seconds: secondsUntilNotification },
          });
        } else {
          // Para iOS, podemos usar a data completa
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data: { productId: product.code, days, screen: 'expiring' },
              sound: true,
            },
            trigger: {
              date: notificationDate,
            },
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
 * Cancela todas as notificações agendadas e reagenda com base nas configurações atuais
 */
export async function refreshAllNotifications(): Promise<boolean> {
  try {
    console.log('[NotificationService] Iniciando atualização de todas as notificações...');
    
    // Verificar permissões antes
    const { status } = await Notifications.getPermissionsAsync();
    console.log('[NotificationService] Status atual de permissões:', status);
    
    if (status !== 'granted') {
      console.warn('[NotificationService] Sem permissões para notificações, solicitando...');
      const result = await requestNotificationPermissions();
      if (!result) {
        console.error('[NotificationService] Permissões negadas, não é possível agendar notificações');
        return false;
      }
    }
    
    // Verificar notificações atualmente agendadas
    const currentScheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationService] Notificações agendadas atualmente: ${currentScheduled.length}`);
    
    // Cancelar todas as notificações anteriores
    console.log('[NotificationService] Cancelando todas as notificações existentes...');
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // No Android, verificar canais
    if (Platform.OS === 'android') {
      console.log('[NotificationService] Verificando canais de notificação no Android');
      await setupNotificationChannels();
    }
    
    // Reagendar todas as notificações
    console.log('[NotificationService] Reagendando notificações para todos os produtos...');
    await scheduleAllProductNotifications();
    
    // Verificar notificações depois de agendar
    const newScheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationService] Notificações reagendadas com sucesso: ${newScheduled.length}`);

  return true;
  } catch (error) {
    console.error('[NotificationService] Erro ao atualizar notificações:', error);
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
    
    // No Android, especificamos o canal
    if (Platform.OS === 'android') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Teste de Notificação',
          body: 'Se você está vendo isso, as notificações estão funcionando! 👍',
          data: { screen: 'test' },
          sound: true,
          channelId: 'default',
        },
        trigger: null, // mostra imediatamente
      });
    } else {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Teste de Notificação',
          body: 'Se você está vendo isso, as notificações estão funcionando! 👍',
          data: { screen: 'test' },
          sound: true,
        },
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

/**
 * Retorna um relatório completo sobre o estado atual do sistema de notificações
 * Útil para depuração e registro de problemas
 * @returns {Promise<string>} Relatório de diagnóstico
 */
export async function getNotificationDiagnosticReport(): Promise<string> {
  try {
    console.log('[Notifications] Gerando relatório de diagnóstico');
    
    // Verificar permissões
    const permissionStatus = await Notifications.getPermissionsAsync();
    
    // Verificar notificações agendadas
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    // Obter configurações do store
    const store = useProductStore.getState();
    const { enabled, notificationDays, quietHours, quietHoursStart, quietHoursEnd } = store.notificationSettings;
    
    // Construir relatório
    let report = '📱 DIAGNÓSTICO DE NOTIFICAÇÕES 📱\n\n';
    
    // Informações do dispositivo
    report += `🔹 Dispositivo: ${Platform.OS} ${Platform.Version}\n`;
    report += `🔹 Expo Device ID: ${Device.modelId || 'Não disponível'}\n\n`;
    
    // Status de permissões
    report += `🔹 Permissões de Notificação: ${permissionStatus.status}\n`;
    report += `🔹 Can use notifications: ${permissionStatus.canAskAgain ? 'Sim' : 'Não'}\n\n`;
    
    // Configurações do app
    report += `🔹 Notificações habilitadas: ${enabled ? 'Sim' : 'Não'}\n`;
    report += `🔹 Dias de notificação: ${notificationDays.length > 0 ? notificationDays.join(', ') : 'Nenhum'}\n`;
    report += `🔹 Modo silencioso: ${quietHours ? 'Ativo' : 'Inativo'}\n`;
    
    if (quietHours) {
      const startHour = Math.floor(quietHoursStart);
      const startMin = Math.round((quietHoursStart - startHour) * 60);
      const endHour = Math.floor(quietHoursEnd);
      const endMin = Math.round((quietHoursEnd - endHour) * 60);
      
      report += `🔹 Horário silencioso: ${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')} - ${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}\n`;
    }
    
    report += '\n';
    
    // Notificações agendadas
    report += `🔹 Notificações agendadas: ${scheduledNotifications.length}\n\n`;
    
    if (scheduledNotifications.length > 0) {
      scheduledNotifications.forEach((notification, index) => {
        report += `📬 Notificação #${index + 1}:\n`;
        report += `   ID: ${notification.identifier}\n`;
        report += `   Título: ${notification.content.title}\n`;
        report += `   Corpo: ${notification.content.body}\n`;
        
        // Trigger info
        if ('seconds' in notification.trigger) {
          report += `   Trigger: Em ${notification.trigger.seconds} segundos\n`;
        } else if ('date' in notification.trigger) {
          report += `   Trigger: ${new Date(notification.trigger.date).toLocaleString('pt-BR')}\n`;
        }
        
        report += '\n';
      });
    } else {
      report += '❌ Nenhuma notificação agendada no momento.\n\n';
    }
    
    // Verificar horário atual
    const now = new Date();
    report += `🔹 Horário atual: ${now.toLocaleString('pt-BR')}\n`;
    report += `🔹 Em horário silencioso: ${isQuietTime() ? 'Sim' : 'Não'}\n\n`;
    
    // Soluções recomendadas
    if (!enabled) {
      report += '⚠️ RECOMENDAÇÃO: Habilite as notificações nas configurações do app.\n';
    }
    
    if (permissionStatus.status !== 'granted') {
      report += '⚠️ RECOMENDAÇÃO: Permissões não concedidas. Verifique as configurações do dispositivo.\n';
    }
    
    if (notificationDays.length === 0) {
      report += '⚠️ RECOMENDAÇÃO: Configure os dias de antecedência para notificações.\n';
    }
    
    if (scheduledNotifications.length === 0 && enabled && permissionStatus.status === 'granted') {
      report += '⚠️ RECOMENDAÇÃO: Não há notificações agendadas. Tente reiniciar o aplicativo.\n';
    }
    
    console.log('[Notifications] Relatório de diagnóstico gerado');
    return report;
  } catch (error) {
    console.error('[Notifications] Erro ao gerar relatório de diagnóstico:', error);
    return `Erro ao gerar relatório: ${error.message}`;
  }
}

// Verificar agendamentos atuais - útil para debug
export async function checkScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[Notifications] Notificações agendadas: ${scheduledNotifications.length}`);
    scheduledNotifications.forEach((notification, index) => {
      console.log(`[Notifications] #${index + 1} ID: ${notification.identifier}`);
      console.log(`[Notifications] Conteúdo:`, notification.content);
      console.log(`[Notifications] Trigger:`, notification.trigger);
    });
    return scheduledNotifications;
  } catch (error) {
    console.error('[Notifications] Erro ao verificar notificações agendadas:', error);
    return [];
  }
}

// Função para reagendar notificações (chamada na inicialização do app)
export async function rescheduleNotifications(): Promise<void> {
  console.log('[Notifications] Reagendando notificações...');
  try {
    // Verificar configurações antes de reagendar
    const store = useProductStore.getState();
    if (!store.notificationSettings.enabled) {
      console.log('[Notifications] Notificações desabilitadas, pulando reagendamento');
      return;
    }
    
    // Cancelar notificações existentes
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // Reagendar
    await scheduleExpirationNotifications();
    
    console.log('[Notifications] Notificações reagendadas com sucesso');
  } catch (error) {
    console.error('[Notifications] Erro ao reagendar notificações:', error);
  }
}

// Registra listeners para o início e retorno do aplicativo
export function registerNotificationListeners(): () => void {
  // Remover botões de diagnóstico e teste, mantendo apenas a lógica essencial
  
  // Retornar função de limpeza
  return () => {
    // Limpeza, se necessário
  };
}

// Agenda notificações para produtos prestes a vencer
export async function scheduleExpirationNotifications(): Promise<void> {
  console.log('[Notifications] Iniciando agendamento de notificações de expiração...');
  const store = useProductStore.getState();
  const products = store.products;
  const { notificationDays, enabled } = store.notificationSettings;
  
  // Verifica se as notificações estão habilitadas
  if (!enabled) {
    console.log('[Notifications] Notificações desabilitadas, pulando agendamento');
    return;
  }
  
  // Verifica se há dias configurados para alertas
  if (!notificationDays || notificationDays.length === 0) {
    console.log('[Notifications] Nenhum dia de alerta configurado');
    return;
  }
  
  // Cancelar notificações existentes
  await Notifications.cancelAllScheduledNotificationsAsync();
  
  // Filtrar produtos válidos (com data de validade)
  const validProducts = products.filter(product => 
    product.expirationDate && 
    product.expirationDate !== '' &&
    !isNaN(new Date(product.expirationDate).getTime())
  );
  
  console.log(`[Notifications] Processando ${validProducts.length} produtos com datas válidas`);
  
  // Processar cada produto
  for (const product of validProducts) {
    const expirationDate = new Date(product.expirationDate);
    const now = new Date();
    
    // Calcular dias até expiração
    const diffTime = expirationDate.getTime() - now.getTime();
    const daysUntilExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    console.log(`[Notifications] Produto "${product.name}", vence em ${daysUntilExpiration} dias (${product.expirationDate})`);
    
    // Verificar se o produto está dentro de algum dos dias de notificação configurados
    if (notificationDays.includes(daysUntilExpiration)) {
      await scheduleProductNotification(product, daysUntilExpiration);
    }
  }
  
  // Verificação final para debug
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  console.log(`[Notifications] Total de ${scheduledNotifications.length} notificações agendadas`);
}

// Agenda uma notificação para um produto específico
async function scheduleProductNotification(product: Product, daysUntilExpiration: number): Promise<void> {
  try {
    console.log(`[Notifications] Agendando notificação para "${product.name}" (${daysUntilExpiration} dias)`);
    
    const store = useProductStore.getState();
    const { soundEnabled } = store.notificationSettings;
    
    // Conteúdo da notificação - Tornando mais explícito e informativo
    const notificationContent: Notifications.NotificationContentInput = {
      title: `ALERTA: ${product.name} está prestes a vencer!`,
      body: `Faltam apenas ${daysUntilExpiration} dia(s) para o produto vencer. Vencimento em: ${new Date(product.expirationDate).toLocaleDateString('pt-BR')}.`,
      data: { 
        productId: product.id, 
        type: 'expiration',
        daysRemaining: daysUntilExpiration,
        name: product.name,
        category: product.category || 'Sem categoria'
      },
      sound: soundEnabled ? true : null,
      // Prioridade alta para Android
      priority: 'high',
      // Especificar o canal para Android
      ...(Platform.OS === 'android' && { channelId: 'expiration-alerts' }),
    };

    // Para testes, usar um atraso muito curto
    // Em produção, você pode ajustar para valores mais razoáveis
    const delayInSeconds = 5; // 5 segundos para testes

    // Especificar um identificador único para a notificação
    const notificationId = `expiration_${product.id}_${daysUntilExpiration}_${Date.now()}`;
    
    // Configurar trigger diferente baseado na plataforma
    let trigger: Notifications.NotificationTriggerInput;
    
    if (Platform.OS === 'android') {
      // Para Android, usar segundos para maior confiabilidade
      trigger = {
        seconds: delayInSeconds,
        repeats: false
      };
    } else {
      // Para iOS, pode usar date para maior precisão
      const scheduledDate = new Date(Date.now() + delayInSeconds * 1000);
      trigger = { date: scheduledDate };
    }
    
    // Agendar notificação
    const identifier = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger,
      identifier: notificationId
    });
    
    console.log(`[Notifications] Notificação agendada com ID: ${identifier || notificationId}`);
    console.log(`[Notifications] Conteúdo: `, notificationContent);
    console.log(`[Notifications] Trigger: `, trigger);
  } catch (error) {
    console.error(`[Notifications] Erro ao agendar notificação para "${product.name}":`, error);
  }
}

/**
 * Envia uma notificação de teste imediata para verificar o funcionamento das notificações
 */
export async function sendTestNotification(): Promise<void> {
  try {
    console.log('[Notifications] Enviando notificação de teste');
    
    // Verifica permissões
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('[Notifications] Permissões não concedidas');
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        console.log('[Notifications] Usuário recusou permissões');
        return;
      }
    }
    
    // Define um ID único para a notificação
    const notificationId = `test_${Date.now()}`;
    
    // Conteúdo da notificação
    const content: Notifications.NotificationContentInput = {
      title: 'Teste de Notificação',
      body: 'Esta é uma notificação de teste enviada às ' + new Date().toLocaleTimeString('pt-BR'),
      data: { type: 'test', timestamp: Date.now() },
      sound: true,
      priority: 'high',
      // Especificar o canal para Android
      ...(Platform.OS === 'android' && { channelId: 'test-notifications' }),
    };
    
    // Trigger imediato
    const trigger: Notifications.NotificationTriggerInput = {
      seconds: 1, // Praticamente imediato
    };
    
    // Envia a notificação
    const identifier = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
      identifier: notificationId,
    });
    
    console.log(`[Notifications] Notificação de teste enviada com ID: ${identifier}`);
    
    return identifier;
  } catch (error) {
    console.error('[Notifications] Erro ao enviar notificação de teste:', error);
  }
}

// Função para verificar o status das permissões de notificação
export async function checkNotificationPermissions(): Promise<Notifications.PermissionResponse> {
  try {
    const permissionStatus = await Notifications.getPermissionsAsync();
    console.log('[Notifications] Status de permissões:', permissionStatus);
    return permissionStatus;
  } catch (error) {
    console.error('[Notifications] Erro ao verificar permissões:', error);
    throw error;
  }
}

// Configura as notificações iniciais
export async function setupNotifications(): Promise<void> {
  console.log('[Notifications] Configurando notificações...');
  const store = useProductStore.getState();
  
  // Apenas prossegue se as notificações estiverem habilitadas
  if (!store.notificationSettings.enabled) {
    console.log('[Notifications] Notificações desabilitadas no app');
    return;
  }
  
  try {
    // Configurar handler global de notificações
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: store.notificationSettings.soundEnabled,
        shouldSetBadge: true,
      }),
    });

    // Configurar canais para Android
    if (Platform.OS === 'android') {
      await setupNotificationChannels();
    }
    
    // Verificar permissões
    const permissionGranted = await requestNotificationPermissions();
    if (!permissionGranted) {
      console.log('[Notifications] Permissões não concedidas');
      return;
    }
    
    // Cancelar notificações existentes antes de reagendar
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[Notifications] Notificações anteriores canceladas');
    
    // Agendar notificações para produtos prestes a vencer
    await scheduleExpirationNotifications();
    
    console.log('[Notifications] Notificações configuradas com sucesso');
  } catch (error) {
    console.error('[Notifications] Erro na configuração de notificações:', error);
  }
} 